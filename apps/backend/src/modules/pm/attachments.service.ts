import { createHash } from 'crypto';
import { AuditService } from '../../infrastructure/audit';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import { atLeast, requireCan, type PmActor } from './pm.access';
import {
  MAX_ATTACHMENTS_PER_TASK,
  MAX_ATTACHMENT_BYTES,
  cleanFileName,
  detectFile,
} from './pm.files';
import { PmRepository } from './pm.repository';
import { TasksService } from './tasks.service';

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const present = (
  row: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    uploadedBy: string;
    createdAt: Date;
  },
  names: Map<string, string>
) => ({
  id: row.id,
  name: row.name,
  mimeType: row.mimeType,
  size: row.size,
  uploadedBy: row.uploadedBy,
  uploadedByName: names.get(row.uploadedBy) ?? null,
  createdAt: row.createdAt,
});

export class AttachmentsService {
  constructor(
    private readonly repo = new PmRepository(),
    private readonly tasks = new TasksService()
  ) {}

  async list(actor: PmActor, taskId: string) {
    await this.tasks.load(actor, taskId);
    const rows = await prisma.pmTaskAttachment.findMany({
      where: { taskId, organizationId: actor.organizationId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        uploadedBy: true,
        createdAt: true,
      },
    });
    const people = await this.repo.names(rows.map((r) => r.uploadedBy));
    const names = new Map(people.map((p) => [p.id, p.fullName]));
    return rows.map((r) => present(r, names));
  }

  async upload(actor: PmActor, taskId: string, input: { fileName: string; base64Data: string }) {
    requireCan(actor, 'pm:tasks:write');
    const { view } = await this.tasks.load(actor, taskId);
    if (!atLeast(view.role, 'CONTRIBUTOR') || view.project.status === 'ARCHIVED') {
      throw new AppError('You cannot add files to this task', 403, 'FORBIDDEN_PROJECT_ROLE');
    }

    const encoded = input.base64Data.replace(/^data:[^;]*;base64,/, '').replace(/\s+/g, '');
    if (!encoded || !BASE64.test(encoded) || encoded.length % 4 === 1) {
      throw new AppError('The file content is not valid base64', 400, 'INVALID_FILE');
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length === 0) throw new AppError('The file is empty', 400, 'INVALID_FILE');
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      throw new AppError('Files can be at most 3 MB', 413, 'FILE_TOO_LARGE');
    }
    const name = cleanFileName(input.fileName);
    if (!name) throw new AppError('The file needs a name', 400, 'INVALID_FILE');
    const detected = detectFile(bytes, name);
    if (!detected) {
      throw new AppError(
        'That file type is not allowed. Use images, PDF, text, CSV, JSON, Word, Excel, PowerPoint or ZIP.',
        415,
        'FILE_TYPE_NOT_ALLOWED'
      );
    }
    const existing = await prisma.pmTaskAttachment.count({ where: { taskId, isDeleted: false } });
    if (existing >= MAX_ATTACHMENTS_PER_TASK) {
      throw new AppError(
        `A task can hold ${MAX_ATTACHMENTS_PER_TASK} files`,
        409,
        'TOO_MANY_FILES'
      );
    }

    const row = await prisma.pmTaskAttachment.create({
      data: {
        organizationId: actor.organizationId,
        taskId,
        name,
        mimeType: detected.mime,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        data: bytes,
        uploadedBy: actor.userId,
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        uploadedBy: true,
        createdAt: true,
      },
    });
    await prisma.pmTaskActivity.create({
      data: {
        organizationId: actor.organizationId,
        taskId,
        actorId: actor.userId,
        type: 'attachment_added',
        data: { name },
      },
    });
    await this.audit(actor, 'pm.task.attachment_added', taskId, null, {
      name,
      size: bytes.length,
      mime: detected.mime,
    });
    return present(row, new Map());
  }

  /** The file for a download. Access is the task's access; the bytes never leave the tenant. */
  async download(actor: PmActor, taskId: string, attachmentId: string) {
    await this.tasks.load(actor, taskId);
    const row = await prisma.pmTaskAttachment.findFirst({
      where: { id: attachmentId, taskId, organizationId: actor.organizationId, isDeleted: false },
    });
    if (!row) throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
    const detected = detectFile(row.data, row.name);
    return {
      name: row.name,
      mime: row.mimeType,
      size: row.size,
      data: row.data,
      inline: !!detected?.inline,
    };
  }

  /** The uploader may remove their file; a project lead may remove anyone's. */
  async remove(actor: PmActor, taskId: string, attachmentId: string) {
    requireCan(actor, 'pm:tasks:write');
    const { view } = await this.tasks.load(actor, taskId);
    const row = await prisma.pmTaskAttachment.findFirst({
      where: { id: attachmentId, taskId, organizationId: actor.organizationId, isDeleted: false },
      select: { id: true, name: true, uploadedBy: true },
    });
    if (!row) throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
    const lead = atLeast(view.role, 'PM_LEAD');
    if (row.uploadedBy !== actor.userId && !lead) {
      throw new AppError('You can only remove your own files', 403, 'FORBIDDEN_ATTACHMENT');
    }
    if (!atLeast(view.role, 'CONTRIBUTOR')) {
      throw new AppError('Viewers cannot change tasks', 403, 'FORBIDDEN_PROJECT_ROLE');
    }
    await prisma.pmTaskAttachment.update({
      where: { id: row.id },
      data: { isDeleted: true, deletedAt: new Date(), data: Buffer.alloc(0) },
    });
    await prisma.pmTaskActivity.create({
      data: {
        organizationId: actor.organizationId,
        taskId,
        actorId: actor.userId,
        type: 'attachment_removed',
        data: { name: row.name },
      },
    });
    await this.audit(actor, 'pm.task.attachment_removed', taskId, { name: row.name }, null);
  }

  private audit(
    actor: PmActor,
    action: string,
    id: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
  ) {
    return AuditService.log({
      action,
      resource: 'pm_task',
      resourceId: id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      before,
      after,
    });
  }
}
