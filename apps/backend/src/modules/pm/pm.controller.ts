import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { PermissionService } from '../../services/auth/permission.service';
import type { PmActor } from './pm.access';
import {
  AddMemberSchema,
  AttachmentSchema,
  TimeEntrySchema,
  TimeUpdateSchema,
  BoardQuerySchema,
  BulkUpdateSchema,
  ColumnPageQuerySchema,
  CommentSchema,
  CreateFromTemplateSchema,
  CreateMilestoneSchema,
  CreateProjectSchema,
  CreateTaskSchema,
  CreateTemplateSchema,
  DependencySchema,
  ListProjectsQuerySchema,
  ListTasksQuerySchema,
  MoveTaskSchema,
  MyTasksQuerySchema,
  PeopleQuerySchema,
  TemplateFromProjectSchema,
  UpdateMemberSchema,
  UpdateMilestoneSchema,
  UpdateProjectSchema,
  UpdateTaskSchema,
  UpdateTemplateSchema,
} from './pm.dto';
import { AttachmentsService } from './attachments.service';
import { ProjectsService } from './projects.service';
import { TimeService } from './time.service';
import { TasksService } from './tasks.service';
import { TemplatesService } from './templates.service';
import { z } from 'zod';

/**
 * Parses with Zod and restores the required fields in the type: this repo compiles with
 * strictNullChecks off, which makes Zod mark every inferred property optional.
 */
const parsed = <T extends z.ZodTypeAny>(schema: T, value: unknown): Required<z.infer<T>> =>
  schema.parse(value) as Required<z.infer<T>>;

const PageSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

/** The verified token plus the permission set requirePermission already loaded. */
export const actorOf = async (req: AuthRequest): Promise<PmActor> => {
  if (!req.userId || !req.tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  req.permissions ??= await PermissionService.loadForUser(req.userId, req.tenantId);
  return { userId: req.userId, organizationId: req.tenantId, permissions: req.permissions };
};

type Handler = (req: AuthRequest, actor: PmActor) => Promise<unknown>;
type Paged = { items: unknown[]; meta: unknown };

const send =
  (message: string, fn: Handler, status = 200) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await fn(req, await actorOf(req));
      if (status === 204) {
        res.status(204).end();
        return;
      }
      const paged = result as Paged | null;
      if (paged && Array.isArray(paged.items) && paged.meta) {
        res.status(status).json({ success: true, message, data: paged.items, meta: paged.meta });
        return;
      }
      res.status(status).json({ success: true, message, data: result });
    } catch (error) {
      next(error);
    }
  };

export class PmController {
  constructor(
    private readonly projects = new ProjectsService(),
    private readonly tasks = new TasksService(),
    private readonly templates = new TemplatesService(),
    private readonly attachments = new AttachmentsService(),
    private readonly time = new TimeService()
  ) {}

  // attachments
  listAttachments = send('Attachments retrieved successfully', (req, a) =>
    this.attachments.list(a, req.params.taskId)
  );
  uploadAttachment = send(
    'File attached successfully',
    (req, a) => this.attachments.upload(a, req.params.taskId, parsed(AttachmentSchema, req.body)),
    201
  );
  deleteAttachment = send(
    'File removed successfully',
    (req, a) => this.attachments.remove(a, req.params.taskId, req.params.attachmentId),
    204
  );
  /** Streams the bytes with headers that stop the browser from running or sniffing the file. */
  downloadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = await this.attachments.download(
        await actorOf(req),
        req.params.taskId,
        req.params.attachmentId
      );
      res.setHeader('Content-Type', file.mime);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader(
        'Content-Disposition',
        `${file.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`
      );
      res.end(file.data);
    } catch (error) {
      next(error);
    }
  };

  // time
  listTime = send('Time retrieved successfully', (req, a) => this.time.list(a, req.params.taskId));
  logTime = send(
    'Time logged successfully',
    (req, a) => this.time.log(a, req.params.taskId, parsed(TimeEntrySchema, req.body)),
    201
  );
  updateTime = send('Time updated successfully', (req, a) =>
    this.time.update(a, req.params.taskId, req.params.entryId, TimeUpdateSchema.parse(req.body))
  );
  deleteTime = send(
    'Time removed successfully',
    (req, a) => this.time.remove(a, req.params.taskId, req.params.entryId),
    204
  );

  // projects
  listProjects = send('Projects retrieved successfully', (req, a) =>
    this.projects.list(a, parsed(ListProjectsQuerySchema, req.query))
  );
  createProject = send(
    'Project created successfully',
    (req, a) => this.projects.create(a, parsed(CreateProjectSchema, req.body)),
    201
  );
  createFromTemplate = send(
    'Project created from template',
    (req, a) => this.templates.createProject(a, parsed(CreateFromTemplateSchema, req.body)),
    201
  );
  getProject = send('Project retrieved successfully', (req, a) =>
    this.projects.get(a, req.params.projectId)
  );
  updateProject = send('Project updated successfully', (req, a) =>
    this.projects.update(a, req.params.projectId, parsed(UpdateProjectSchema, req.body))
  );
  deleteProject = send(
    'Project deleted successfully',
    (req, a) => this.projects.remove(a, req.params.projectId),
    204
  );
  progress = send('Progress retrieved successfully', (req, a) =>
    this.projects.progress(a, req.params.projectId)
  );
  report = send('Report retrieved successfully', (req, a) =>
    this.projects.report(a, req.params.projectId)
  );

  // members
  people = send('People retrieved successfully', (req, a) =>
    this.projects.people(a, parsed(PeopleQuerySchema, req.query))
  );
  listMembers = send('Members retrieved successfully', (req, a) =>
    this.projects.listMembers(a, req.params.projectId)
  );
  addMember = send(
    'Member added successfully',
    (req, a) => this.projects.addMember(a, req.params.projectId, parsed(AddMemberSchema, req.body)),
    201
  );
  updateMember = send('Member updated successfully', (req, a) =>
    this.projects.updateMember(
      a,
      req.params.projectId,
      req.params.userId,
      parsed(UpdateMemberSchema, req.body).role
    )
  );
  removeMember = send(
    'Member removed successfully',
    (req, a) => this.projects.removeMember(a, req.params.projectId, req.params.userId),
    204
  );

  // milestones
  createMilestone = send(
    'Milestone created successfully',
    (req, a) =>
      this.projects.createMilestone(
        a,
        req.params.projectId,
        parsed(CreateMilestoneSchema, req.body)
      ),
    201
  );
  updateMilestone = send('Milestone updated successfully', (req, a) =>
    this.projects.updateMilestone(
      a,
      req.params.projectId,
      req.params.milestoneId,
      parsed(UpdateMilestoneSchema, req.body)
    )
  );
  deleteMilestone = send(
    'Milestone deleted successfully',
    (req, a) => this.projects.removeMilestone(a, req.params.projectId, req.params.milestoneId),
    204
  );

  // tasks
  board = send('Board retrieved successfully', (req, a) =>
    this.tasks.board(a, req.params.projectId, parsed(BoardQuerySchema, req.query))
  );
  boardColumn = send('Column retrieved successfully', (req, a) =>
    this.tasks.columnPage(a, req.params.projectId, parsed(ColumnPageQuerySchema, req.query))
  );
  listTasks = send('Tasks retrieved successfully', (req, a) =>
    this.tasks.list(a, req.params.projectId, parsed(ListTasksQuerySchema, req.query))
  );
  createTask = send(
    'Task created successfully',
    (req, a) => this.tasks.create(a, req.params.projectId, parsed(CreateTaskSchema, req.body)),
    201
  );
  myTasks = send('Tasks retrieved successfully', (req, a) =>
    this.tasks.mine(a, parsed(MyTasksQuerySchema, req.query))
  );
  bulkTasks = send('Tasks updated successfully', (req, a) =>
    this.tasks.bulkUpdate(a, parsed(BulkUpdateSchema, req.body))
  );
  getTask = send('Task retrieved successfully', (req, a) => this.tasks.get(a, req.params.taskId));
  updateTask = send('Task updated successfully', (req, a) =>
    this.tasks.update(a, req.params.taskId, parsed(UpdateTaskSchema, req.body))
  );
  moveTask = send('Task moved successfully', (req, a) =>
    this.tasks.move(a, req.params.taskId, parsed(MoveTaskSchema, req.body))
  );
  deleteTask = send(
    'Task deleted successfully',
    (req, a) => this.tasks.remove(a, req.params.taskId),
    204
  );
  taskActivity = send('Activity retrieved successfully', (req, a) =>
    this.tasks.activity(a, req.params.taskId, parsed(PageSchema, req.query))
  );

  // comments
  listComments = send('Comments retrieved successfully', (req, a) =>
    this.tasks.comments(a, req.params.taskId, parsed(PageSchema, req.query))
  );
  addComment = send(
    'Comment added successfully',
    (req, a) => this.tasks.addComment(a, req.params.taskId, parsed(CommentSchema, req.body).body),
    201
  );
  editComment = send('Comment updated successfully', (req, a) =>
    this.tasks.editComment(
      a,
      req.params.taskId,
      req.params.commentId,
      parsed(CommentSchema, req.body).body
    )
  );
  deleteComment = send(
    'Comment deleted successfully',
    (req, a) => this.tasks.deleteComment(a, req.params.taskId, req.params.commentId),
    204
  );

  // dependencies
  addDependency = send(
    'Dependency added successfully',
    (req, a) =>
      this.tasks.addDependency(
        a,
        req.params.taskId,
        parsed(DependencySchema, req.body).dependsOnTaskId
      ),
    201
  );
  removeDependency = send(
    'Dependency removed successfully',
    (req, a) => this.tasks.removeDependency(a, req.params.taskId, req.params.dependsOnTaskId),
    204
  );

  // templates
  listTemplates = send('Templates retrieved successfully', (_req, a) => this.templates.list(a));
  getTemplate = send('Template retrieved successfully', (req, a) =>
    this.templates.get(a, req.params.templateId)
  );
  createTemplate = send(
    'Template created successfully',
    (req, a) => this.templates.create(a, parsed(CreateTemplateSchema, req.body)),
    201
  );
  updateTemplate = send('Template updated successfully', (req, a) =>
    this.templates.update(a, req.params.templateId, parsed(UpdateTemplateSchema, req.body))
  );
  deleteTemplate = send(
    'Template deleted successfully',
    (req, a) => this.templates.remove(a, req.params.templateId),
    204
  );
  templateFromProject = send(
    'Template created from project',
    (req, a) =>
      this.templates.fromProject(
        a,
        req.params.projectId,
        parsed(TemplateFromProjectSchema, req.body)
      ),
    201
  );
}
