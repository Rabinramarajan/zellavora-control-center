import { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { PermissionService } from '../../services/auth';
import {
  AccessPreviewSchema,
  ActionCommentSchema,
  ApprovalProvisioningSchema,
  AddNoteSchema,
  CreateUserRequestSchema,
  RequiredCommentSchema,
  UpdateUserRequestSchema,
  UserRequestListQuerySchema,
} from './user-request.dto';
import { RequestActor, UserRequestService } from './user-request.service';

const actorOf = (req: AuthRequest): RequestActor => {
  if (!req.userId || !req.tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return {
    userId: req.userId,
    organizationId: req.tenantId,
    canManage: !!req.permissions && PermissionService.has(req.permissions, 'users:manage'),
    can: (permission) => !!req.permissions && PermissionService.has(req.permissions, permission),
  };
};

type Handler = (req: AuthRequest, actor: RequestActor) => Promise<unknown>;

const handle =
  (message: string, fn: Handler, status = 200) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await fn(req, actorOf(req));
      res.status(status).json({ success: true, message, data });
    } catch (err) {
      next(err);
    }
  };

export class UserRequestController {
  constructor(private readonly service = new UserRequestService()) {}

  list = handle('Requests retrieved successfully', (req, actor) =>
    this.service.list(actor.organizationId, UserRequestListQuerySchema.parse(req.query))
  );
  lookups = handle('Request lookups retrieved successfully', (_req, actor) =>
    this.service.lookups(actor.organizationId)
  );
  preview = handle('Access preview generated successfully', (req, actor) =>
    this.service.preview(AccessPreviewSchema.parse(req.body), actor.organizationId)
  );
  getById = handle('Request retrieved successfully', (req, actor) =>
    this.service.getById(req.params.id, actor)
  );
  requestPreview = handle('Request access preview generated successfully', (req, actor) =>
    this.service.previewForRequest(req.params.id, actor.organizationId)
  );
  audit = handle('Request audit trail retrieved successfully', (req, actor) =>
    this.service.audit(req.params.id, actor.organizationId)
  );
  create = handle(
    'Request created successfully',
    (req, actor) => this.service.create(CreateUserRequestSchema.parse(req.body), actor),
    201
  );
  update = handle('Request updated successfully', (req, actor) =>
    this.service.update(req.params.id, UpdateUserRequestSchema.parse(req.body), actor)
  );
  submit = handle('Request submitted successfully', (req, actor) =>
    this.service.submit(req.params.id, actor)
  );
  approve = handle('Request approved successfully', (req, actor) =>
    this.service.approve(req.params.id, ActionCommentSchema.parse(req.body ?? {}).comments, actor)
  );
  setApprovalProvisioning = handle('Approval provisioning updated successfully', (req, actor) =>
    this.service.setApprovalProvisioning(
      req.params.id,
      ApprovalProvisioningSchema.parse(req.body),
      actor
    )
  );
  reject = handle('Request rejected successfully', (req, actor) =>
    this.service.reject(req.params.id, RequiredCommentSchema.parse(req.body).comments, actor)
  );
  sendBack = handle('Request sent back for changes', (req, actor) =>
    this.service.sendBack(req.params.id, RequiredCommentSchema.parse(req.body).comments, actor)
  );
  cancel = handle('Request cancelled successfully', (req, actor) =>
    this.service.cancel(req.params.id, ActionCommentSchema.parse(req.body ?? {}).comments, actor)
  );
  retryProvisioning = handle('Provisioning retry started successfully', (req, actor) =>
    this.service.retryProvisioning(req.params.id, actor)
  );
  addNote = handle(
    'Note added successfully',
    (req, actor) => this.service.addNote(req.params.id, AddNoteSchema.parse(req.body), actor),
    201
  );
  retryEmail = handle('Email retry sent successfully', (req, actor) =>
    this.service.retryEmail(req.params.id, req.params.emailId, actor)
  );
}
