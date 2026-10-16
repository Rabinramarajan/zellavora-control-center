import { z } from 'zod';

/**
 * Free text from users (descriptions, comments). It is stored and returned as plain text: control
 * characters are dropped, and clients must render it as text, never as HTML.
 */
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

export const plainText = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(CONTROL_CHARS, '').trim())
    .pipe(z.string().max(max));

const uuid = z.string().uuid();
const date = z.coerce.date();
const nullableDate = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable());

export const PROJECT_KEY = /^[A-Z][A-Z0-9]{1,9}$/;
export const COLUMN_KEY = /^[A-Z][A-Z0-9_]{0,38}$/;

export const ColumnSchema = z
  .object({
    key: z.string().regex(COLUMN_KEY, 'Use capital letters, digits and underscores'),
    label: z.string().trim().min(1).max(40),
    done: z.boolean().default(false),
  })
  .strict();
export type Column = z.infer<typeof ColumnSchema>;

export const DEFAULT_COLUMNS: Column[] = [
  { key: 'TODO', label: 'To do', done: false },
  { key: 'IN_PROGRESS', label: 'In progress', done: false },
  { key: 'REVIEW', label: 'Review', done: false },
  { key: 'DONE', label: 'Done', done: true },
];

export const ColumnsSchema = z
  .array(ColumnSchema)
  .min(2, 'A board needs at least two columns')
  .max(12)
  .superRefine((columns, ctx) => {
    if (new Set(columns.map((c) => c.key)).size !== columns.length) {
      ctx.addIssue({ code: 'custom', message: 'Column keys must be unique' });
    }
    if (!columns.some((c) => c.done)) {
      ctx.addIssue({ code: 'custom', message: 'At least one column must mean done' });
    }
  });

export const ProjectStatus = z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);
export const Visibility = z.enum(['PRIVATE', 'TEAM', 'ORG']);
export const MemberRole = z.enum(['PM_LEAD', 'CONTRIBUTOR', 'VIEWER']);
export const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const Recurrence = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);

const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};
const order = z.enum(['asc', 'desc']).default('desc');
const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

// ---------------------------------------------------------------- projects
export const CreateProjectSchema = z
  .object({
    key: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PROJECT_KEY, '2 to 10 capital letters or digits, starting with a letter'),
    name: z.string().trim().min(2).max(160),
    description: plainText(5000).optional(),
    status: ProjectStatus.default('PLANNED'),
    visibility: Visibility.default('PRIVATE'),
    ownerId: uuid.optional(),
    teamId: uuid.nullish(),
    startDate: nullableDate.optional(),
    dueDate: nullableDate.optional(),
    budgetHours: z.number().min(0).max(1_000_000).nullish(),
    columns: ColumnsSchema.optional(),
  })
  .strict();

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: plainText(5000).nullable(),
    status: ProjectStatus,
    visibility: Visibility,
    ownerId: uuid,
    teamId: uuid.nullable(),
    startDate: nullableDate,
    dueDate: nullableDate,
    budgetHours: z.number().min(0).max(1_000_000).nullable(),
    columns: ColumnsSchema,
  })
  .partial()
  .strict();

export const ListProjectsQuerySchema = z
  .object({
    ...paging,
    q: z.string().trim().max(100).optional(),
    status: ProjectStatus.optional(),
    mine: boolQuery.optional(),
    sort: z.enum(['name', 'key', 'dueDate', 'createdAt', 'updatedAt']).default('updatedAt'),
    order,
  })
  .strict();

export const CreateFromTemplateSchema = z
  .object({
    templateId: uuid,
    key: CreateProjectSchema.shape.key,
    name: CreateProjectSchema.shape.name,
    startDate: date.optional(),
    visibility: Visibility.default('PRIVATE'),
  })
  .strict();

// ---------------------------------------------------------------- members and milestones
export const AddMemberSchema = z
  .object({ userId: uuid, role: MemberRole.default('CONTRIBUTOR') })
  .strict();
export const UpdateMemberSchema = z.object({ role: MemberRole }).strict();

export const CreateMilestoneSchema = z
  .object({ name: z.string().trim().min(1).max(160), dueDate: nullableDate.optional() })
  .strict();
export const UpdateMilestoneSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    dueDate: nullableDate,
    status: z.enum(['OPEN', 'DONE']),
  })
  .partial()
  .strict();

// ---------------------------------------------------------------- tasks
export const CreateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: plainText(20000).optional(),
    status: z.string().regex(COLUMN_KEY).optional(),
    priority: Priority.default('MEDIUM'),
    assigneeId: uuid.nullish(),
    parentId: uuid.nullish(),
    milestoneId: uuid.nullish(),
    dueDate: nullableDate.optional(),
    estimateHours: z.number().min(0).max(100_000).nullish(),
    recurrence: Recurrence.default('NONE'),
  })
  .strict();

export const UpdateTaskSchema = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(300),
    description: plainText(20000).nullable(),
    priority: Priority,
    assigneeId: uuid.nullable(),
    parentId: uuid.nullable(),
    milestoneId: uuid.nullable(),
    dueDate: nullableDate,
    estimateHours: z.number().min(0).max(100_000).nullable(),
    recurrence: Recurrence,
  })
  .partial()
  .required({ version: true })
  .strict();

export const MoveTaskSchema = z
  .object({
    version: z.number().int().min(1),
    status: z.string().regex(COLUMN_KEY),
    /** Place the task directly after this task; omit to put it first in the column. */
    afterTaskId: uuid.nullish(),
  })
  .strict();

export const BulkUpdateSchema = z
  .object({
    taskIds: z.array(uuid).min(1).max(100),
    changes: z
      .object({
        status: z.string().regex(COLUMN_KEY),
        priority: Priority,
        assigneeId: uuid.nullable(),
        milestoneId: uuid.nullable(),
        dueDate: nullableDate,
      })
      .partial()
      .strict()
      .refine((c) => Object.keys(c).length > 0, 'Nothing to change'),
  })
  .strict();

export const ListTasksQuerySchema = z
  .object({
    ...paging,
    q: z.string().trim().max(100).optional(),
    status: z.string().regex(COLUMN_KEY).optional(),
    priority: Priority.optional(),
    assigneeId: uuid.optional(),
    milestoneId: uuid.optional(),
    overdue: boolQuery.optional(),
    mine: boolQuery.optional(),
    sort: z
      .enum(['number', 'title', 'priority', 'dueDate', 'createdAt', 'updatedAt'])
      .default('number'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

export const BoardQuerySchema = z
  .object({
    perColumn: z.coerce.number().int().min(1).max(100).default(25),
    assigneeId: uuid.optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();

export const ColumnPageQuerySchema = z
  .object({
    status: z.string().regex(COLUMN_KEY),
    cursor: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const AttachmentSchema = z
  .object({ fileName: z.string().trim().min(1).max(255), base64Data: z.string().min(1) })
  .strict();

export const TimeEntrySchema = z
  .object({
    hours: z.number().gt(0).max(24),
    workDate: z.coerce.date(),
    note: plainText(500).nullish(),
  })
  .strict();
export const TimeUpdateSchema = TimeEntrySchema.partial().strict();

export const PeopleQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const MyTasksQuerySchema = z
  .object({ ...paging, includeDone: boolQuery.optional() })
  .strict();

// ---------------------------------------------------------------- comments and dependencies
export const CommentSchema = z.object({ body: plainText(5000).pipe(z.string().min(1)) }).strict();
export const DependencySchema = z.object({ dependsOnTaskId: uuid }).strict();

// ---------------------------------------------------------------- templates
export const TemplateDefinitionSchema = z
  .object({
    columns: ColumnsSchema.default(DEFAULT_COLUMNS),
    milestones: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            offsetDays: z.number().int().min(0).max(3650).default(0),
          })
          .strict()
      )
      .max(50)
      .default([]),
    tasks: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(300),
            description: plainText(20000).optional(),
            priority: Priority.default('MEDIUM'),
            estimateHours: z.number().min(0).max(100_000).optional(),
            column: z.string().regex(COLUMN_KEY).optional(),
            milestone: z.string().trim().max(160).optional(),
            offsetDays: z.number().int().min(0).max(3650).optional(),
          })
          .strict()
      )
      .max(500)
      .default([]),
  })
  .strict();
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;

export const CreateTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: plainText(2000).optional(),
    definition: TemplateDefinitionSchema,
  })
  .strict();
export const UpdateTemplateSchema = CreateTemplateSchema.partial().strict();
export const TemplateFromProjectSchema = z
  .object({ name: z.string().trim().min(2).max(160), description: plainText(2000).optional() })
  .strict();

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type MoveTaskDto = z.infer<typeof MoveTaskSchema>;
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;
