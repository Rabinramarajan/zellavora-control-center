import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { logger } from '../../infrastructure/logger';
import type { TxClient } from '../../infrastructure/prisma';
import { getRequestContext } from '../../infrastructure/request-context';
import { InvitationService } from '../invitation/invitation.service';
import { AccessCalculator, applyRequest } from './user-request.access';
import {
  AccessPreviewDto,
  AddNoteDto,
  ApprovalProvisioningDto,
  CreateUserRequestDto,
  RequestPayload,
  RequestPayloadSchema,
  UpdateUserRequestDto,
  UserRequestListQueryDto,
} from './user-request.dto';
import { UserRequestNotifier } from './user-request.notifier';
import { composeFullName, UserRequestProvisioner } from './user-request.provisioner';
import { UserRequestDetailRow, UserRequestRepository } from './user-request.repository';
import {
  CANCELLABLE_STATUSES,
  EDITABLE_STATUSES,
  REQUEST_STATUSES,
  RequestStatus,
  RequestType,
  STATUS_LABELS,
  TYPE_LABELS,
  needsTargetUser,
} from './user-request.types';

export interface RequestActor {
  userId: string;
  organizationId: string;
  canManage: boolean;
  /** Whether the actor holds a permission (e.g. `user-requests:approve`); gates allowed actions. */
  can: (permission: string) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Pure: what a self-registered account still needs before it can be provisioned.
 *
 * A registrant supplies no organizational placement — by design, since they
 * usually guess it wrong — so the approver has to fill it in. Reported on the
 * detail response so the UI can disable Approve and say why, and enforced in
 * `approve` so the API cannot be driven past it.
 */
export function missingProvisioningFields(row: {
  type: string;
  payload: unknown;
}): string[] {
  if (row.type !== 'NEW_USER') return [];
  const payload = (row.payload ?? {}) as {
    organization?: { departmentId?: string | null; branchId?: string | null };
    access?: { addRoleIds?: string[] };
  };
  const missing: string[] = [];
  if (!payload.organization?.departmentId) missing.push('organization.departmentId');
  if (!payload.organization?.branchId) missing.push('organization.branchId');
  if (!payload.access?.addRoleIds?.length) missing.push('access.addRoleIds');
  return missing;
}

/** Pure: the fields a request of this type must carry before it can be submitted. */
export function validateForSubmit(
  type: RequestType,
  payload: RequestPayload,
  targetUserId: string | null
): string[] {
  const errors: string[] = [];
  const { user, employee, contact, organization, access } = payload;
  if (needsTargetUser(type) && !targetUserId)
    errors.push('Requested For (existing user) is required');

  switch (type) {
    case 'NEW_USER':
      if (!user.username) errors.push('Username is required');
      if (!user.firstName) errors.push('First Name is required');
      if (!user.lastName) errors.push('Last Name is required');
      if (!user.userType) errors.push('User Type is required');
      if (!employee.employeeCode) errors.push('Employee Code is required');
      if (!employee.employmentType) errors.push('Employment Type is required');
      if (!contact.workEmail) errors.push('Work Email is required');
      if (!organization.branchId) errors.push('Branch is required');
      if (!organization.departmentId) errors.push('Department is required');
      break;
    case 'UPDATE_USER': {
      const touched = [user, employee, contact].some((section) =>
        Object.values(section).some((v) => v !== null && v !== undefined)
      );
      if (!touched && !organization.reportingManagerId)
        errors.push('Change at least one user, employee or contact field');
      break;
    }
    case 'ACCESS_CHANGE':
      if (
        !access.addGroupIds.length &&
        !access.removeGroupIds.length &&
        !access.addRoleIds.length &&
        !access.removeRoleIds.length
      ) {
        errors.push('Add or remove at least one group or role');
      }
      break;
    case 'ADD_ROLE':
      if (!access.addRoleIds.length) errors.push('Select at least one role to add');
      break;
    case 'REMOVE_ROLE':
      if (!access.removeRoleIds.length) errors.push('Select at least one role to remove');
      break;
    case 'ADD_GROUP':
      if (!access.addGroupIds.length) errors.push('Select at least one group to add');
      break;
    case 'REMOVE_GROUP':
      if (!access.removeGroupIds.length) errors.push('Select at least one group to remove');
      break;
    case 'TRANSFER':
      if (!organization.branchId && !organization.departmentId && !organization.teamId) {
        errors.push('Select the new branch, department or team');
      }
      break;
    default:
      break;
  }

  const overlap = (a: string[], b: string[]) => a.some((id) => b.includes(id));
  if (overlap(access.addRoleIds, access.removeRoleIds))
    errors.push('A role cannot be both added and removed');
  if (overlap(access.addGroupIds, access.removeGroupIds))
    errors.push('A group cannot be both added and removed');
  return errors;
}

/**
 * User request workflow.
 *
 *   DRAFT → SUBMITTED → PENDING_APPROVAL → (approval chain) → APPROVED → PROVISIONING → COMPLETED
 *                                        ↘ REJECTED / SENT_BACK (→ edit → resubmit) / CANCELLED
 *   PROVISIONING → FAILED (retryable)
 *
 * COMPLETED is only reached once the change is really applied: for NEW_USER that
 * means the invitee accepted the invitation, not merely that the account row exists.
 */
export class UserRequestService {
  private readonly access: AccessCalculator;
  private readonly notifier: UserRequestNotifier;
  private readonly provisioner: UserRequestProvisioner;

  constructor(private readonly repo = new UserRequestRepository()) {
    this.access = new AccessCalculator(repo);
    this.notifier = new UserRequestNotifier(repo);
    this.provisioner = new UserRequestProvisioner(repo);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(organizationId: string, query: UserRequestListQueryDto) {
    const [{ data, total }, counts] = await Promise.all([
      this.repo.list(organizationId, query),
      this.repo.statusCounts(organizationId),
    ]);
    const byStatus = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<
      RequestStatus,
      number
    >;
    for (const row of counts) byStatus[row.status as RequestStatus] = row._count._all;

    const [branches] = await this.repo.namesFor({
      branchIds: [...new Set(data.map((r) => r.branchId).filter((v): v is string => !!v))],
      departmentIds: [],
      teamIds: [],
    });
    return {
      data: data.map((r) => ({
        id: r.id,
        refNo: r.refNo,
        type: r.type,
        typeLabel: TYPE_LABELS[r.type as RequestType] ?? r.type,
        status: r.status,
        statusLabel: STATUS_LABELS[r.status as RequestStatus] ?? r.status,
        priority: r.priority,
        name: r.subjectName,
        email: r.subjectEmail,
        employeeCode: r.employeeCode,
        branchName: branches.find((b) => b.id === r.branchId)?.name ?? null,
        requestedBy: r.requestedBy ? { id: r.requestedBy.id, name: r.requestedBy.fullName } : null,
        createdAt: r.createdAt.toISOString(),
      })),
      counts: byStatus,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async lookups(organizationId: string) {
    const [branches, departments, teams, groups, roles] = await this.repo.lookups(organizationId);
    return { branches, departments, teams, groups, roles };
  }

  async getById(id: string, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    return this.toDetail(row, actor);
  }

  async preview(dto: AccessPreviewDto, organizationId: string) {
    const current = await this.access.currentAccess(dto.targetUserId, organizationId);
    return this.access.preview(current, applyRequest(current, dto.type, dto.payload));
  }

  async previewForRequest(id: string, organizationId: string) {
    const row = await this.load(id, organizationId);
    const payload = RequestPayloadSchema.parse(row.payload);
    const type = row.type as RequestType;
    // Once provisioned, "current" would already include the change; compare against the submission snapshot.
    const snapshot = row.snapshot as { access?: ReturnType<typeof applyRequest> } | null;
    const settled = ['APPROVED', 'PROVISIONING', 'COMPLETED'].includes(row.status);
    const current =
      settled && snapshot?.access
        ? snapshot.access
        : await this.access.currentAccess(
            type === 'NEW_USER' ? null : row.targetUserId,
            organizationId
          );
    return this.access.preview(current, applyRequest(current, type, payload));
  }

  async audit(id: string, organizationId: string) {
    const row = await this.load(id, organizationId);
    const logs = await this.repo.listAudit(row.id, row.targetUserId);
    return logs.map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const { before, after, ...rest } = meta;
      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        actor: log.actor?.fullName ?? 'System',
        action: log.action,
        module: 'IAM',
        target: log.resource === 'user' ? `User ${log.resourceId}` : row.refNo,
        before: (before as Record<string, unknown> | null) ?? null,
        after: (after as Record<string, unknown> | null) ?? null,
        result: log.severity === 'error' || log.severity === 'critical' ? 'Failure' : 'Success',
        correlationId: log.requestId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: rest,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Draft lifecycle
  // ---------------------------------------------------------------------------

  async create(dto: CreateUserRequestDto, actor: RequestActor) {
    await this.assertReferences(dto.type, dto.targetUserId, dto.payload, actor.organizationId);
    const searchable = await this.searchColumns(
      dto.type,
      dto.targetUserId,
      dto.payload,
      actor.organizationId
    );

    const created = await this.repo.transaction(async (tx) => {
      const refNo = await this.repo.nextRefNo(tx);
      const request = await this.repo.create(
        {
          organizationId: actor.organizationId,
          refNo,
          type: dto.type,
          priority: dto.priority,
          source: 'ADMIN_PORTAL',
          targetUserId: needsTargetUser(dto.type) ? dto.targetUserId : null,
          requestedById: actor.userId,
          justification: dto.justification,
          effectiveFrom: dto.effectiveFrom,
          effectiveUntil: dto.effectiveUntil,
          attachmentUrl: dto.attachmentUrl,
          payload: dto.payload as Prisma.InputJsonValue,
          createdBy: actor.userId,
          ...searchable,
        },
        tx
      );
      await this.addEvent(tx, request.id, null, 'DRAFT', actor.userId, 'Request created');
      await AuditService.log(
        {
          action: 'user_request.created',
          resource: 'user_request',
          resourceId: request.id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          after: { refNo, type: dto.type, priority: dto.priority },
        },
        tx
      );
      return request;
    });

    if (dto.submit) return this.submit(created.id, actor);
    return this.getById(created.id, actor);
  }

  async update(id: string, dto: UpdateUserRequestDto, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    this.assertStatus(
      row.status,
      EDITABLE_STATUSES,
      'Only draft or sent-back requests can be edited'
    );
    this.assertOwnerOrManager(row, actor);
    const type = row.type as RequestType;
    await this.assertReferences(type, dto.targetUserId, dto.payload, actor.organizationId);
    const searchable = await this.searchColumns(
      type,
      dto.targetUserId,
      dto.payload,
      actor.organizationId
    );

    await this.repo.transaction(async (tx) => {
      await this.repo.claim(id, row, tx);
      await this.repo.update(
        id,
        {
          targetUserId: needsTargetUser(type) ? dto.targetUserId : null,
          priority: dto.priority,
          justification: dto.justification,
          effectiveFrom: dto.effectiveFrom,
          effectiveUntil: dto.effectiveUntil,
          attachmentUrl: dto.attachmentUrl,
          payload: dto.payload as Prisma.InputJsonValue,
          updatedBy: actor.userId,
          ...searchable,
        },
        tx
      );
    });
    await AuditService.log({
      action: 'user_request.edited',
      resource: 'user_request',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before: {
        priority: row.priority,
        justification: row.justification,
        payload: row.payload as Record<string, unknown>,
      },
      after: { priority: dto.priority, justification: dto.justification, payload: dto.payload },
    });
    return this.getById(id, actor);
  }

  async submit(id: string, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    this.assertStatus(
      row.status,
      EDITABLE_STATUSES,
      'Only draft or sent-back requests can be submitted'
    );
    this.assertOwnerOrManager(row, actor);
    const type = row.type as RequestType;
    const payload = RequestPayloadSchema.parse(row.payload);

    const errors = validateForSubmit(type, payload, row.targetUserId);
    if (type === 'NEW_USER') {
      const conflicts = await this.repo.findConflicts({
        email: payload.contact.workEmail,
        username: payload.user.username,
        employeeCode: payload.employee.employeeCode,
      });
      for (const c of conflicts) {
        if (payload.contact.workEmail && c.email.toLowerCase() === payload.contact.workEmail)
          errors.push('Work Email is already in use');
        if (payload.user.username && c.username === payload.user.username)
          errors.push('Username is already taken');
        if (
          payload.employee.employeeCode &&
          c.employeeCode?.toLowerCase() === payload.employee.employeeCode.toLowerCase()
        ) {
          errors.push('Employee Code is already in use');
        }
      }
    }
    if (errors.length) {
      throw new AppError(errors.join('. '), 400, 'REQUEST_INCOMPLETE', { errors });
    }

    const current = await this.access.currentAccess(
      type === 'NEW_USER' ? null : row.targetUserId,
      actor.organizationId
    );
    const preview = await this.access.preview(current, applyRequest(current, type, payload));
    const target = row.targetUserId
      ? await this.repo.findUserForRequest(row.targetUserId, actor.organizationId)
      : null;
    const managerId = payload.organization.reportingManagerId ?? target?.reportingManagerId ?? null;
    const manager =
      managerId && managerId !== actor.userId ? await this.repo.findUserName(managerId) : null;

    const steps: Array<{ stepName: string; approverId: string | null; approverName: string }> = [];
    if (manager)
      steps.push({
        stepName: 'Manager Approval',
        approverId: manager.id,
        approverName: manager.fullName,
      });
    steps.push({
      stepName: 'IAM / Admin Approval',
      approverId: null,
      approverName: 'IAM Administrators',
    });
    if (preview.privileged)
      steps.push({
        stepName: 'Security Approval',
        approverId: null,
        approverName: 'Security Administrators',
      });

    const now = new Date();
    await this.repo.transaction(async (tx) => {
      await this.repo.claim(id, row, tx);
      await this.repo.createApprovals(
        steps.map((s, i) => ({
          requestId: id,
          level: i + 1,
          stepName: s.stepName,
          approverId: s.approverId,
          approverName: s.approverName,
          status: i === 0 ? 'PENDING' : 'WAITING',
          assignedAt: i === 0 ? now : null,
        })),
        tx
      );
      await this.repo.update(
        id,
        {
          status: 'PENDING_APPROVAL',
          currentStep: 1,
          submittedAt: now,
          failureReason: null,
          snapshot: {
            access: current,
            capturedAt: now.toISOString(),
          } as unknown as Prisma.InputJsonValue,
          updatedBy: actor.userId,
        },
        tx
      );
      await this.addEvent(
        tx,
        id,
        row.status,
        'SUBMITTED',
        actor.userId,
        row.status === 'SENT_BACK' ? 'Resubmitted' : null
      );
      await this.addEvent(
        tx,
        id,
        'SUBMITTED',
        'PENDING_APPROVAL',
        null,
        `Awaiting ${steps[0].stepName}`
      );
      await AuditService.log(
        {
          action: 'user_request.submitted',
          resource: 'user_request',
          resourceId: id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          metadata: { steps: steps.map((s) => s.stepName), privileged: preview.privileged },
        },
        tx
      );
      await AuditService.log(
        {
          action: 'user_request.approver_assigned',
          resource: 'user_request',
          resourceId: id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          metadata: { step: steps[0].stepName, approver: steps[0].approverName },
        },
        tx
      );
    });

    const ref = { ...row, status: 'PENDING_APPROVAL' };
    await this.notifier.notify(ref, 'SUBMITTED', row.requestedBy?.email, 'Request submitted');
    if (manager)
      await this.notifier.notify(
        ref,
        'APPROVAL_REQUIRED',
        manager.email,
        `Assigned: ${steps[0].stepName}`
      );
    return this.getById(id, actor);
  }

  async cancel(id: string, comments: string | null, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    this.assertStatus(row.status, CANCELLABLE_STATUSES, 'This request can no longer be cancelled');
    this.assertOwnerOrManager(row, actor);
    await this.repo.transaction(async (tx) => {
      await this.repo.claim(id, row, tx);
      await this.repo.closeOpenApprovals(id, 'CANCELLED', tx);
      await this.repo.update(
        id,
        { status: 'CANCELLED', currentStep: null, updatedBy: actor.userId },
        tx
      );
      await this.addEvent(tx, id, row.status, 'CANCELLED', actor.userId, comments);
      await AuditService.log(
        {
          action: 'user_request.cancelled',
          resource: 'user_request',
          resourceId: id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          severity: 'warning',
          metadata: { comments },
        },
        tx
      );
    });
    return this.getById(id, actor);
  }

  // ---------------------------------------------------------------------------
  // Approval chain
  // ---------------------------------------------------------------------------

  async approve(id: string, comments: string | null, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    const step = this.assertCanAct(row, actor);

    const next = row.approvals.find((a) => a.status === 'WAITING' && a.level === step.level + 1);

    // Only on the final approval: an intermediate approver is endorsing the
    // request, and should not be forced to complete someone else's placement.
    if (!next) {
      const missing = missingProvisioningFields(row);
      if (missing.length) {
        throw new AppError(
          'Assign a department, branch and at least one role before approving.',
          400,
          'PROVISIONING_DETAILS_REQUIRED',
          { fields: Object.fromEntries(missing.map((f) => [f, 'Required before approval.'])) }
        );
      }
    }
    const actorName = await this.actorName(actor.userId);
    const now = new Date();

    await this.repo.transaction(async (tx) => {
      await this.repo.claim(id, row, tx);
      await this.repo.updateApproval(
        step.id,
        {
          status: 'APPROVED',
          actionedAt: now,
          actionedById: actor.userId,
          actionedByName: actorName,
          comments,
        },
        tx
      );
      if (next) {
        await this.repo.updateApproval(next.id, { status: 'PENDING', assignedAt: now }, tx);
        await this.repo.update(id, { currentStep: next.level, updatedBy: actor.userId }, tx);
        await this.addEvent(
          tx,
          id,
          'PENDING_APPROVAL',
          'PENDING_APPROVAL',
          actor.userId,
          `${step.stepName} approved${comments ? `: ${comments}` : ''}. Awaiting ${next.stepName}`
        );
      } else {
        await this.repo.update(
          id,
          { status: 'APPROVED', currentStep: null, updatedBy: actor.userId },
          tx
        );
        await this.addEvent(tx, id, 'PENDING_APPROVAL', 'APPROVED', actor.userId, comments);
      }
      await AuditService.log(
        {
          action: next ? 'user_request.step_approved' : 'user_request.approved',
          resource: 'user_request',
          resourceId: id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          metadata: { step: step.stepName, level: step.level, comments },
        },
        tx
      );
    });

    if (next) {
      if (next.approverId) {
        const approver = await this.repo.findUserName(next.approverId);
        await this.notifier.notify(
          { ...row, status: 'PENDING_APPROVAL' },
          'APPROVAL_REQUIRED',
          approver?.email,
          `Assigned: ${next.stepName}`
        );
      }
      return this.getById(id, actor);
    }

    await this.notifier.notify(
      { ...row, status: 'APPROVED' },
      'APPROVED',
      row.requestedBy?.email,
      'Final approval granted',
      comments
    );
    await this.runProvisioning(id, actor);
    return this.getById(id, actor);
  }

  /** Let the active approver complete placement without reopening the whole request. */
  async setApprovalProvisioning(
    id: string,
    dto: ApprovalProvisioningDto,
    actor: RequestActor
  ) {
    const row = await this.load(id, actor.organizationId);
    this.assertCanAct(row, actor);
    if (row.type !== 'NEW_USER') {
      throw new AppError(
        'Provisioning placement only applies to new-user requests',
        409,
        'INVALID_REQUEST_TYPE'
      );
    }

    const payload = RequestPayloadSchema.parse(row.payload);
    const updatedPayload: RequestPayload = {
      ...payload,
      organization: {
        ...payload.organization,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
      },
      access: { ...payload.access, addRoleIds: [...new Set(dto.roleIds)] },
    };
    await this.assertReferences('NEW_USER', row.targetUserId, updatedPayload, actor.organizationId);
    const searchable = await this.searchColumns(
      'NEW_USER',
      row.targetUserId,
      updatedPayload,
      actor.organizationId
    );

    await this.repo.transaction(async (tx) => {
      await this.repo.claim(id, row, tx);
      await this.repo.update(
        id,
        {
          payload: updatedPayload as Prisma.InputJsonValue,
          updatedBy: actor.userId,
          ...searchable,
        },
        tx
      );
    });
    await AuditService.log({
      action: 'user_request.approval_provisioning_updated',
      resource: 'user_request',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before: { payload: row.payload as Record<string, unknown> },
      after: { payload: updatedPayload },
    });
    return this.getById(id, actor);
  }

  async reject(id: string, comments: string, actor: RequestActor) {
    return this.decline(id, comments, actor, 'REJECTED');
  }

  async sendBack(id: string, comments: string, actor: RequestActor) {
    return this.decline(id, comments, actor, 'SENT_BACK');
  }

  private async decline(
    id: string,
    comments: string,
    actor: RequestActor,
    outcome: 'REJECTED' | 'SENT_BACK'
  ) {
    const row = await this.load(id, actor.organizationId);
    const step = this.assertCanAct(row, actor);
    const actorName = await this.actorName(actor.userId);

    await this.repo.transaction(async (tx) => {
      await this.repo.claim(id, row, tx);
      await this.repo.updateApproval(
        step.id,
        {
          status: outcome,
          actionedAt: new Date(),
          actionedById: actor.userId,
          actionedByName: actorName,
          comments,
        },
        tx
      );
      await this.repo.closeOpenApprovals(id, 'CANCELLED', tx);
      await this.repo.update(
        id,
        { status: outcome, currentStep: null, updatedBy: actor.userId },
        tx
      );
      await this.addEvent(tx, id, row.status, outcome, actor.userId, comments);
      await this.repo.addNote(
        {
          requestId: id,
          noteType: 'APPROVAL',
          visibility: 'REQUESTER',
          body: comments,
          authorId: actor.userId,
          authorName: actorName,
        },
        tx
      );
      await AuditService.log(
        {
          action: outcome === 'REJECTED' ? 'user_request.rejected' : 'user_request.sent_back',
          resource: 'user_request',
          resourceId: id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          severity: 'warning',
          metadata: { step: step.stepName, comments },
        },
        tx
      );
    });

    await this.notifier.notify(
      { ...row, status: outcome },
      outcome,
      row.requestedBy?.email,
      `${step.stepName} ${outcome === 'REJECTED' ? 'rejected' : 'sent back'}`,
      comments
    );
    return this.getById(id, actor);
  }

  // ---------------------------------------------------------------------------
  // Provisioning
  // ---------------------------------------------------------------------------

  async retryProvisioning(id: string, actor: RequestActor) {
    if (!actor.canManage)
      throw new AppError(
        'Only IAM administrators can retry provisioning',
        403,
        'FORBIDDEN_PERMISSION'
      );
    const row = await this.load(id, actor.organizationId);
    this.assertStatus(row.status, ['FAILED'], 'Only failed requests can be retried');
    // A double-clicked or concurrent retry must not provision twice.
    await this.repo.transaction((tx) => this.repo.claim(id, row, tx));
    await this.runProvisioning(id, actor);
    return this.getById(id, actor);
  }

  private async runProvisioning(id: string, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    await this.repo.transaction(async (tx) => {
      await this.repo.update(id, { status: 'PROVISIONING', failureReason: null }, tx);
      await this.addEvent(
        tx,
        id,
        row.status,
        'PROVISIONING',
        actor.userId,
        row.status === 'FAILED' ? 'Provisioning retried' : null
      );
    });

    const payload = RequestPayloadSchema.parse(row.payload);
    try {
      const result = await this.provisioner.provision(
        {
          id,
          type: row.type as RequestType,
          organizationId: actor.organizationId,
          targetUserId: row.targetUserId,
          payload,
        },
        actor.userId
      );

      if (result.awaitingActivation && result.inviteEmail) {
        await this.repo.update(id, { targetUserId: result.userId });
        await this.repo.addNote({
          requestId: id,
          noteType: 'PROVISIONING',
          visibility: 'INTERNAL',
          body: 'Account created with organization, groups and roles. Awaiting invitation acceptance to complete.',
          authorName: 'System',
        });
        await AuditService.log({
          action: 'user_request.provisioning.account_created',
          resource: 'user_request',
          resourceId: id,
          organizationId: actor.organizationId,
          actorId: actor.userId,
          metadata: { userId: result.userId },
        });
        await this.sendInvitation(id, result.userId, result.inviteEmail, payload, actor);
        return;
      }

      await this.complete(id, actor.userId, 'Provisioning completed');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`[user-requests] provisioning ${row.refNo} failed: ${reason}`);
      await this.repo.transaction(async (tx) => {
        await this.repo.update(id, { status: 'FAILED', failureReason: reason }, tx);
        await this.addEvent(tx, id, 'PROVISIONING', 'FAILED', null, reason);
        await AuditService.log(
          {
            action: 'user_request.provisioning.failed',
            resource: 'user_request',
            resourceId: id,
            organizationId: actor.organizationId,
            actorId: actor.userId,
            severity: 'error',
            metadata: { reason },
          },
          tx
        );
      });
      await this.notifier.notify(
        { ...row, status: 'FAILED' },
        'FAILED',
        row.requestedBy?.email,
        'Provisioning failed',
        reason
      );
    }
  }

  private async sendInvitation(
    requestId: string,
    userId: string,
    email: string,
    payload: RequestPayload,
    actor: RequestActor
  ) {
    try {
      await new InvitationService().issueForUser(
        { userId, email, firstName: payload.user.firstName, lastName: payload.user.lastName },
        { userId: actor.userId, organizationId: actor.organizationId }
      );
      await this.notifier.recordInvitation(requestId, email, { ok: true });
    } catch (err) {
      await this.notifier.recordInvitation(requestId, email, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Called when an invitee sets their password: NEW_USER requests waiting on activation complete here. */
  /**
   * Raises the approval request for a self-registered account.
   *
   * The account already exists in PENDING, which blocks login, so the request
   * carries targetUserId from the start — unlike an admin-raised NEW_USER
   * request, where provisioning creates the account later.
   *
   * It is opened directly in PENDING_APPROVAL: there is no draft stage, because
   * the person who filled the form is not an operator who could submit it.
   */
  async onSelfRegistration(input: {
    userId: string;
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  }) {
    const now = new Date();
    const payload = {
      user: { firstName: input.firstName, lastName: input.lastName, userType: 'EMPLOYEE' },
      employee: {},
      contact: { workEmail: input.email },
      organization: {},
      access: {},
    };

    const request = await this.repo.transaction(async (tx) => {
      const refNo = await this.repo.nextRefNo(tx);
      const created = await this.repo.create(
        {
          organizationId: input.organizationId,
          refNo,
          type: 'NEW_USER',
          status: 'PENDING_APPROVAL',
          priority: 'NORMAL',
          source: 'SYSTEM',
          targetUserId: input.userId,
          requestedById: input.userId,
          subjectName: input.fullName,
          subjectEmail: input.email,
          justification: 'Self-registration through the sign-up page',
          payload: payload as unknown as Prisma.InputJsonValue,
          currentStep: 1,
          submittedAt: now,
        },
        tx
      );
      await this.repo.createApprovals(
        [
          {
            requestId: created.id,
            level: 1,
            stepName: 'IAM / Admin Approval',
            approverId: null,
            approverName: 'IAM Administrators',
            status: 'PENDING',
            assignedAt: now,
          },
        ],
        tx
      );
      await this.addEvent(tx, created.id, null, 'SUBMITTED', input.userId, 'Self-registered');
      await this.addEvent(
        tx,
        created.id,
        'SUBMITTED',
        'PENDING_APPROVAL',
        null,
        'Awaiting IAM / Admin Approval'
      );
      await AuditService.log(
        {
          action: 'user_request.self_registered',
          resource: 'user_request',
          resourceId: created.id,
          organizationId: input.organizationId,
          actorId: input.userId,
          after: { refNo, type: 'NEW_USER', email: input.email },
        },
        tx
      );
      return created;
    });

    // Best-effort: a failed notification must not undo a completed registration.
    await this.announceSelfRegistration(
      request,
      input.email,
      () => this.repo.findApproverEmails(input.organizationId),
      'self_registration'
    );
    return request;
  }

  /**
   * Raises the platform-level request for a newly registered organization. The
   * organization row already exists in `pending_verification`; approval
   * activates it and its owner.
   */
  async onOrganizationRegistration(input: {
    userId: string;
    organizationId: string;
    organizationName: string;
    clientCode: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  }) {
    const now = new Date();
    const payload = {
      user: { firstName: input.firstName, lastName: input.lastName, userType: 'EMPLOYEE' },
      employee: {},
      contact: { workEmail: input.email },
      organization: { name: input.organizationName, clientCode: input.clientCode },
      access: {},
    };

    const request = await this.repo.transaction(async (tx) => {
      const refNo = await this.repo.nextRefNo(tx);
      const created = await this.repo.create(
        {
          organizationId: input.organizationId,
          refNo,
          type: 'NEW_ORGANIZATION',
          status: 'PENDING_APPROVAL',
          priority: 'HIGH',
          source: 'SYSTEM',
          targetUserId: input.userId,
          requestedById: input.userId,
          subjectName: input.organizationName,
          subjectEmail: input.email,
          justification: `New organization "${input.organizationName}" (${input.clientCode}) registered through the sign-up page`,
          payload: payload as unknown as Prisma.InputJsonValue,
          currentStep: 1,
          submittedAt: now,
        },
        tx
      );
      await this.repo.createApprovals(
        [
          {
            requestId: created.id,
            level: 1,
            stepName: 'Platform Approval',
            approverId: null,
            approverName: 'Platform Administrators',
            status: 'PENDING',
            assignedAt: now,
          },
        ],
        tx
      );
      await this.addEvent(
        tx,
        created.id,
        null,
        'SUBMITTED',
        input.userId,
        'Organization self-registered'
      );
      await this.addEvent(
        tx,
        created.id,
        'SUBMITTED',
        'PENDING_APPROVAL',
        null,
        'Awaiting Platform Approval'
      );
      await AuditService.log(
        {
          action: 'user_request.self_registered',
          resource: 'user_request',
          resourceId: created.id,
          organizationId: input.organizationId,
          actorId: input.userId,
          after: {
            refNo,
            type: 'NEW_ORGANIZATION',
            email: input.email,
            clientCode: input.clientCode,
          },
        },
        tx
      );
      return created;
    });

    await this.announceSelfRegistration(
      request,
      input.email,
      () => this.repo.findPlatformAdminEmails(),
      'organization_registration'
    );
    return request;
  }

  /**
   * APPROVAL_REQUIRED goes to the people who can approve; the registrant gets
   * SUBMITTED. Previously the registrant received APPROVAL_REQUIRED, which told
   * them to open an IAM screen they cannot reach and left approvers unaware.
   */
  private async announceSelfRegistration(
    request: Parameters<UserRequestNotifier['notify']>[0],
    registrantEmail: string,
    approvers: () => Promise<string[]>,
    trigger: string
  ) {
    await this.notifier
      .notify(request, 'SUBMITTED', registrantEmail, trigger)
      .catch(() => undefined);

    const recipients = await approvers().catch((e) => {
      logger.error(`[user-requests] approver lookup failed: ${(e as Error).message}`);
      return [] as string[];
    });
    if (!recipients.length) {
      logger.warn(
        `[user-requests] ${request.refNo} has no reachable approver; it is visible in the queue but nobody was emailed`
      );
      return;
    }
    await Promise.all(
      recipients.map((to) =>
        this.notifier.notify(request, 'APPROVAL_REQUIRED', to, trigger).catch(() => undefined)
      )
    );
  }

  async onInvitationAccepted(userId: string) {
    try {
      const pending = await this.repo.findProvisioningForUser(userId);
      for (const request of pending) {
        await this.complete(request.id, userId, 'Invitation accepted; account activated');
      }
    } catch (err) {
      logger.error(
        `[user-requests] completion after invitation acceptance failed: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  private async complete(id: string, actorId: string, comment: string) {
    const request = await this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(
        id,
        { status: 'COMPLETED', completedAt: new Date() },
        tx
      );
      await this.addEvent(tx, id, 'PROVISIONING', 'COMPLETED', actorId, comment);
      await AuditService.log(
        {
          action: 'user_request.provisioning.completed',
          resource: 'user_request',
          resourceId: id,
          organizationId: updated.organizationId,
          actorId,
        },
        tx
      );
      return updated;
    });
    const requester = request.requestedById
      ? await this.repo.findUserName(request.requestedById)
      : null;
    await this.notifier.notify(request, 'COMPLETED', requester?.email, comment);
  }

  // ---------------------------------------------------------------------------
  // Notes & email history
  // ---------------------------------------------------------------------------

  async addNote(id: string, dto: AddNoteDto, actor: RequestActor) {
    const row = await this.load(id, actor.organizationId);
    const note = await this.repo.addNote({
      requestId: row.id,
      noteType: dto.noteType,
      visibility: dto.visibility,
      body: dto.body,
      attachmentUrl: dto.attachmentUrl,
      authorId: actor.userId,
      authorName: await this.actorName(actor.userId),
    });
    await AuditService.log({
      action: 'user_request.note_added',
      resource: 'user_request',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      metadata: { noteId: note.id, noteType: dto.noteType, visibility: dto.visibility },
    });
    return this.getById(id, actor);
  }

  async retryEmail(id: string, emailId: string, actor: RequestActor) {
    if (!actor.canManage)
      throw new AppError('Only IAM administrators can retry emails', 403, 'FORBIDDEN_PERMISSION');
    const row = await this.load(id, actor.organizationId);
    const email = await this.repo.findEmail(emailId, row.id);
    if (!email) throw new AppError('Email not found', 404, 'EMAIL_NOT_FOUND');
    if (email.deliveryStatus !== 'FAILED')
      throw new AppError('Only failed emails can be retried', 409, 'EMAIL_NOT_FAILED');

    if (email.template === 'INVITATION') {
      if (!row.targetUserId)
        throw new AppError(
          'The account for this invitation does not exist',
          409,
          'USER_NOT_PROVISIONED'
        );
      const payload = RequestPayloadSchema.parse(row.payload);
      try {
        await new InvitationService().issueForUser(
          {
            userId: row.targetUserId,
            email: email.recipient,
            firstName: payload.user.firstName,
            lastName: payload.user.lastName,
          },
          { userId: actor.userId, organizationId: actor.organizationId }
        );
        await this.notifier.markInvitationRetried(email.id, email.attempts, { ok: true });
      } catch (err) {
        await this.notifier.markInvitationRetried(email.id, email.attempts, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      await this.notifier.resend(email);
    }
    await AuditService.log({
      action: 'user_request.email_retried',
      resource: 'user_request',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      metadata: { emailId, template: email.template, recipient: email.recipient },
    });
    return this.getById(id, actor);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async load(id: string, organizationId: string) {
    if (!UUID_PATTERN.test(id))
      throw new AppError('User request not found', 404, 'USER_REQUEST_NOT_FOUND');
    const row = await this.repo.findDetail(id, organizationId);
    if (!row) throw new AppError('User request not found', 404, 'USER_REQUEST_NOT_FOUND');
    return row;
  }

  private assertStatus(status: string, allowed: readonly string[], message: string) {
    if (!allowed.includes(status)) throw new AppError(message, 409, 'INVALID_REQUEST_STATUS');
  }

  private assertOwnerOrManager(row: UserRequestDetailRow, actor: RequestActor) {
    if (row.requestedById !== actor.userId && !actor.canManage) {
      throw new AppError(
        'Only the requester or an IAM administrator can do this',
        403,
        'FORBIDDEN_PERMISSION'
      );
    }
  }

  private currentStep(row: UserRequestDetailRow) {
    return row.status === 'PENDING_APPROVAL'
      ? (row.approvals.find((a) => a.status === 'PENDING') ?? null)
      : null;
  }

  private canActOn(row: UserRequestDetailRow, actor: RequestActor): boolean {
    const step = this.currentStep(row);
    if (!step) return false;
    return step.approverId ? step.approverId === actor.userId || actor.canManage : actor.canManage;
  }

  private assertCanAct(row: UserRequestDetailRow, actor: RequestActor) {
    const step = this.currentStep(row);
    if (!step)
      throw new AppError('This request is not awaiting approval', 409, 'INVALID_REQUEST_STATUS');
    if (!this.canActOn(row, actor)) {
      throw new AppError(`You are not an approver for ${step.stepName}`, 403, 'NOT_APPROVER');
    }
    return step;
  }

  private async actorName(userId: string) {
    return (await this.repo.findUserName(userId))?.fullName ?? null;
  }

  private async addEvent(
    tx: TxClient,
    requestId: string,
    from: string | null,
    to: string,
    actorId: string | null,
    comments?: string | null
  ) {
    const actorName = actorId
      ? (await tx.user.findUnique({ where: { id: actorId }, select: { fullName: true } }))?.fullName
      : 'System';
    await this.repo.addEvent(
      {
        requestId,
        fromStatus: from,
        toStatus: to,
        actorId,
        actorName: actorName ?? null,
        comments: comments ?? null,
        correlationId: getRequestContext().requestId ?? null,
      },
      tx
    );
  }

  private async assertReferences(
    type: RequestType,
    targetUserId: string | null,
    payload: RequestPayload,
    organizationId: string
  ) {
    if (needsTargetUser(type) && targetUserId) {
      const target = await this.repo.findUserForRequest(targetUserId, organizationId);
      if (!target)
        throw new AppError('Requested user not found in this organization', 404, 'USER_NOT_FOUND');
    }
    const { organization: org, access } = payload;
    const checks: Array<['branch' | 'department' | 'team' | 'group' | 'role', string[], string]> = [
      ['branch', org.branchId ? [org.branchId] : [], 'Branch'],
      ['department', org.departmentId ? [org.departmentId] : [], 'Department'],
      ['team', org.teamId ? [org.teamId] : [], 'Team'],
      ['group', [...new Set([...access.addGroupIds, ...access.removeGroupIds])], 'Group'],
      ['role', [...new Set([...access.addRoleIds, ...access.removeRoleIds])], 'Role'],
    ];
    for (const [model, ids, label] of checks) {
      if (
        ids.length &&
        (await this.repo.countExisting(model, ids, organizationId)) !== ids.length
      ) {
        throw new AppError(`${label} not found`, 400, 'INVALID_REFERENCE');
      }
    }
  }

  private async searchColumns(
    type: RequestType,
    targetUserId: string | null,
    payload: RequestPayload,
    organizationId: string
  ) {
    const target =
      needsTargetUser(type) && targetUserId
        ? await this.repo.findUserForRequest(targetUserId, organizationId)
        : null;
    const { access, organization } = payload;
    return {
      subjectName: composeFullName(payload.user) ?? target?.fullName ?? null,
      subjectEmail: payload.contact.workEmail ?? target?.email ?? null,
      employeeCode: payload.employee.employeeCode ?? target?.employeeCode ?? null,
      branchId: organization.branchId ?? target?.branchId ?? null,
      departmentId: organization.departmentId ?? target?.userTenants[0]?.departmentId ?? null,
      teamId: organization.teamId ?? target?.teams[0]?.id ?? null,
      groupIds: [
        ...new Set([
          ...access.addGroupIds,
          ...access.removeGroupIds,
          ...(target?.userGroups.map((g) => g.groupId) ?? []),
        ]),
      ],
      roleIds: [
        ...new Set([
          ...access.addRoleIds,
          ...access.removeRoleIds,
          ...(target?.roleAssignments.map((r) => r.roleId) ?? []),
        ]),
      ],
    };
  }

  private async toDetail(row: UserRequestDetailRow, actor: RequestActor) {
    const payload = RequestPayloadSchema.parse(row.payload);
    const { organization: org, access } = payload;
    const [[branches, departments, teams], lookups, people] = await Promise.all([
      this.repo.namesFor({
        branchIds: org.branchId ? [org.branchId] : [],
        departmentIds: org.departmentId ? [org.departmentId] : [],
        teamIds: org.teamId ? [org.teamId] : [],
      }),
      Promise.all([
        this.repo.groupsWithRoles([...access.addGroupIds, ...access.removeGroupIds]),
        this.repo.rolesWithPermissions([...access.addRoleIds, ...access.removeRoleIds]),
      ]),
      this.repo.findUsersByIds(
        [org.reportingManagerId, org.assignedOfficerId].filter((v): v is string => !!v)
      ),
    ]);
    const [groups, roles] = lookups;
    const names: Record<string, string> = {};
    for (const item of [...branches, ...departments, ...teams, ...groups, ...roles])
      names[item.id] = item.name;
    for (const p of people) names[p.id] = p.fullName;

    const step = this.currentStep(row);
    const isOwner = row.requestedById === actor.userId;
    const editable =
      EDITABLE_STATUSES.includes(row.status as RequestStatus) && (isOwner || actor.canManage);
    const canDecide = this.canActOn(row, actor);
    // Self-registrations arrive with no placement, so the approver has to add
    // one. Surfaced here so the UI can disable Approve and name what is
    // missing, rather than letting the request fail at provisioning. Only the
    // final approval is blocked, matching `approve`: an intermediate approver
    // endorses the request and should not have to complete it.
    const isFinalApproval =
      !!step && !row.approvals.some((a) => a.status === 'WAITING' && a.level > step.level);
    const missingProvisioning = isFinalApproval ? missingProvisioningFields(row) : [];

    return {
      id: row.id,
      refNo: row.refNo,
      type: row.type,
      typeLabel: TYPE_LABELS[row.type as RequestType] ?? row.type,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status as RequestStatus] ?? row.status,
      priority: row.priority,
      source: row.source,
      subjectName: row.subjectName,
      subjectEmail: row.subjectEmail,
      employeeCode: row.employeeCode,
      targetUser: row.targetUser
        ? {
            id: row.targetUser.id,
            name: row.targetUser.fullName,
            email: row.targetUser.email,
            employeeCode: row.targetUser.employeeCode,
            status: row.targetUser.status,
          }
        : null,
      requestedBy: row.requestedBy
        ? { id: row.requestedBy.id, name: row.requestedBy.fullName, email: row.requestedBy.email }
        : null,
      justification: row.justification,
      effectiveFrom: iso(row.effectiveFrom),
      effectiveUntil: iso(row.effectiveUntil),
      attachmentUrl: row.attachmentUrl,
      payload,
      names,
      currentStep: step
        ? { level: step.level, stepName: step.stepName, approverName: step.approverName }
        : null,
      submittedAt: iso(row.submittedAt),
      completedAt: iso(row.completedAt),
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      approvals: row.approvals.map((a) => ({
        id: a.id,
        level: a.level,
        stepName: a.stepName,
        approverName: a.approverName,
        status: a.status,
        assignedAt: iso(a.assignedAt),
        actionedAt: iso(a.actionedAt),
        actionedByName: a.actionedByName,
        comments: a.comments,
      })),
      events: row.events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        toStatusLabel: STATUS_LABELS[e.toStatus as RequestStatus] ?? e.toStatus,
        actorName: e.actorName,
        comments: e.comments,
        correlationId: e.correlationId,
        createdAt: e.createdAt.toISOString(),
      })),
      notes: row.notes.map((n) => ({
        id: n.id,
        noteType: n.noteType,
        visibility: n.visibility,
        body: n.body,
        attachmentUrl: n.attachmentUrl,
        authorName: n.authorName ?? 'System',
        createdAt: n.createdAt.toISOString(),
      })),
      emails: row.emails.map((m) => ({
        id: m.id,
        template: m.template,
        recipient: m.recipient,
        subject: m.subject,
        bodyText: m.bodyText,
        trigger: m.trigger,
        deliveryStatus: m.deliveryStatus,
        attempts: m.attempts,
        lastError: m.lastError,
        sentAt: iso(m.sentAt),
        createdAt: m.createdAt.toISOString(),
      })),
      // Field paths the approver must fill before Approve will be accepted.
      missingProvisioning,
      actions: {
        // Workflow state and role decide eligibility; the granular permission must also be held.
        canEdit: editable && actor.can('user-requests:update'),
        canSubmit: editable && actor.can('user-requests:submit'),
        canApprove:
          canDecide && actor.can('user-requests:approve') && missingProvisioning.length === 0,
        canCompleteProvisioning:
          canDecide && actor.can('user-requests:approve') && missingProvisioning.length > 0,
        canReject: canDecide && actor.can('user-requests:reject'),
        canSendBack: canDecide && actor.can('user-requests:send-back'),
        canCancel:
          CANCELLABLE_STATUSES.includes(row.status as RequestStatus) &&
          (isOwner || actor.canManage) &&
          actor.can('user-requests:cancel'),
        canRetryProvisioning:
          row.status === 'FAILED' && actor.canManage && actor.can('user-requests:retry'),
        canRetryEmail: actor.canManage && actor.can('user-requests:retry'),
      },
    };
  }
}
