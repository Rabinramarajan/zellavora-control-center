import { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { PermissionService } from '../../services/auth';
import { AddUserNoteSchema } from './user-admin.dto';
import { AdminActor, UserAdminService } from './user-admin.service';

const actorOf = (req: AuthRequest): AdminActor => {
  if (!req.userId || !req.tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return {
    userId: req.userId,
    organizationId: req.tenantId,
    canManage: !!req.permissions && PermissionService.has(req.permissions, 'users:manage'),
    canRequest: !!req.permissions && PermissionService.has(req.permissions, 'user-requests:create'),
    sessionId: req.sessionId,
  };
};

const handle =
  (fn: (req: AuthRequest, actor: AdminActor) => Promise<unknown>, status = 200) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.status(status).json({ success: true, data: await fn(req, actorOf(req)) });
    } catch (err) {
      next(err);
    }
  };

/** User Details sections and security actions (`/api/v1/iam/users/:id/...`). */
export class UserAdminController {
  constructor(private readonly service = new UserAdminService()) {}

  profile = handle((req, actor) => this.service.profile(req.params.id, actor));
  access = handle((req, actor) => this.service.access(req.params.id, actor.organizationId));
  sessions = handle((req, actor) => this.service.sessions(req.params.id, actor));
  revokeSession = handle((req, actor) =>
    this.service.revokeSession(req.params.id, req.params.sessionId, actor)
  );
  revokeAllSessions = handle((req, actor) => this.service.revokeAllSessions(req.params.id, actor));
  notes = handle((req) => this.service.notes(req.params.id));
  addNote = handle(
    (req, actor) => this.service.addNote(req.params.id, AddUserNoteSchema.parse(req.body), actor),
    201
  );
  requests = handle((req, actor) =>
    this.service.requestHistory(req.params.id, actor.organizationId)
  );
  statusHistory = handle((req) => this.service.statusHistory(req.params.id));
  emails = handle((req) => this.service.emailHistory(req.params.id));
  audit = handle((req) => this.service.audit(req.params.id));
  sendPasswordReset = handle((req, actor) => this.service.sendPasswordReset(req.params.id, actor));
  resendInvitation = handle((req, actor) => this.service.resendInvitation(req.params.id, actor));
}
