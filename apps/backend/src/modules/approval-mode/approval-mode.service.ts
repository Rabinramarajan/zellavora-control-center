import { ApprovalMode, TimesheetStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { AuditService } from '../../infrastructure/audit';
import { AppError } from '../../middleware/error';

export interface ApprovalModeView {
  organizationMode: ApprovalMode;
  memberMode: ApprovalMode | null;
  effectiveMode: ApprovalMode;
}

export class ApprovalModeService {
  /** The mode governing one member's sheets: their own override, else the organization's. */
  public static async forMember(userId: string, organizationId: string): Promise<ApprovalMode> {
    return (await this.view(userId, organizationId)).effectiveMode;
  }

  public static async view(userId: string, organizationId: string): Promise<ApprovalModeView> {
    const [organization, membership] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { approvalMode: true },
      }),
      prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId: organizationId } },
        select: { approvalMode: true },
      }),
    ]);
    if (!organization) throw new AppError('Organization not found', 404, 'TENANT_NOT_FOUND');
    const memberMode = membership?.approvalMode ?? null;
    return {
      organizationMode: organization.approvalMode,
      memberMode,
      effectiveMode: memberMode ?? organization.approvalMode,
    };
  }

  public static async setOrganizationMode(
    organizationId: string,
    mode: ApprovalMode,
    actorUserId: string
  ): Promise<ApprovalMode> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { approvalMode: true },
    });
    if (!organization) throw new AppError('Organization not found', 404, 'TENANT_NOT_FOUND');
    if (organization.approvalMode === mode) return mode;

    if (mode === ApprovalMode.NONE) {
      // Only members who inherit the organization's mode are affected.
      const overriding = await prisma.userTenant.findMany({
        where: { tenantId: organizationId, approvalMode: { not: null } },
        select: { userId: true },
      });
      await this.assertNothingPending(organizationId, {
        notIn: overriding.map((member) => member.userId),
      });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { approvalMode: mode },
    });
    await AuditService.log({
      action: 'organization.approval_mode_changed',
      resource: 'organization',
      resourceId: organizationId,
      organizationId,
      actorId: actorUserId,
      before: { approvalMode: organization.approvalMode },
      after: { approvalMode: mode },
    });
    return mode;
  }

  /** `null` puts the member back on the organization's mode. */
  public static async setMemberMode(
    organizationId: string,
    userId: string,
    mode: ApprovalMode | null,
    actorUserId: string
  ): Promise<ApprovalModeView> {
    const before = await this.view(userId, organizationId);
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId: organizationId } },
      select: { userId: true },
    });
    if (!membership) throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');

    const effective = mode ?? before.organizationMode;
    if (effective === ApprovalMode.NONE && before.effectiveMode !== ApprovalMode.NONE) {
      await this.assertNothingPending(organizationId, { in: [userId] });
    }

    await prisma.userTenant.update({
      where: { userId_tenantId: { userId, tenantId: organizationId } },
      data: { approvalMode: mode },
    });
    await AuditService.log({
      action: 'member.approval_mode_changed',
      resource: 'organization_member',
      resourceId: userId,
      organizationId,
      actorId: actorUserId,
      before: { approvalMode: before.memberMode },
      after: { approvalMode: mode },
    });
    return this.view(userId, organizationId);
  }

  /**
   * Turning approval off would strand sheets already waiting for a reviewer,
   * since nobody could decide on them afterwards. The queue must be cleared first.
   */
  private static async assertNothingPending(
    organizationId: string,
    userId: { in: string[] } | { notIn: string[] }
  ): Promise<void> {
    const scope = { organizationId, userId, deletedAt: null };
    const [daily, monthly, timesheets] = await Promise.all([
      prisma.dailySheet.count({ where: { ...scope, status: 'submitted' } }),
      prisma.monthlySheet.count({ where: { ...scope, status: 'submitted' } }),
      prisma.timesheet.count({ where: { ...scope, status: TimesheetStatus.SUBMITTED } }),
    ]);
    const pending = daily + monthly + timesheets;
    if (pending > 0) {
      throw new AppError(
        `${pending} submitted sheet(s) are waiting for review; approve or reject them before turning approval off`,
        409,
        'APPROVAL_QUEUE_NOT_EMPTY',
        { daily, monthly, timesheets }
      );
    }
  }
}
