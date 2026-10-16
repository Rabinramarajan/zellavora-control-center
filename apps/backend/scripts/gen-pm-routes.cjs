/**
 * Generates src/modules/pm/pm.routes.ts from the table below, so each route, its permission and
 * its OpenAPI block stay in step. Run: node scripts/gen-pm-routes.cjs
 */
const fs = require('fs');
const path = require('path');

const R = [
  // [method, path, operationId, summary, permission, handler, description, extra]
  ['get', '/projects', 'getPmProjects', 'listPmProjects', 'pm:projects:read', 'listProjects', 'Projects you can see, with progress. Filters: q, status, mine. Paged.'],
  ['post', '/projects', 'postPmProjects', 'createPmProject', 'pm:projects:write', 'createProject', 'Create a project. The creator or the chosen owner becomes its lead.'],
  ['post', '/projects/from-template', 'postPmProjectsFromTemplate', 'createPmProjectFromTemplate', 'pm:projects:write', 'createFromTemplate', 'Create a project with the board, milestones and tasks of a template.'],
  ['get', '/people', 'getPmPeople', 'listPmPeople', 'pm:projects:manage-members', 'people', 'Active people of the organization, for choosing project members. Filter: q.'],
  ['get', '/my-tasks', 'getPmMyTasks', 'listPmMyTasks', 'pm:tasks:read', 'myTasks', 'Open tasks assigned to you across every project you can see.'],
  ['post', '/tasks/bulk', 'postPmTasksBulk', 'bulkUpdatePmTasks', 'pm:tasks:write', 'bulkTasks', 'Apply one change to up to 100 tasks, all or nothing.'],
  ['get', '/projects/:projectId', 'getPmProjectsById', 'getPmProject', 'pm:projects:read', 'getProject', 'One project with members, milestones and progress.'],
  ['patch', '/projects/:projectId', 'patchPmProjectsById', 'updatePmProject', 'pm:projects:write', 'updateProject', 'Edit a project. Set status ARCHIVED to archive it. Leads only.'],
  ['delete', '/projects/:projectId', 'deletePmProjectsById', 'deletePmProject', 'pm:projects:write', 'deleteProject', 'Soft-delete a project and its tasks. Leads only.'],
  ['get', '/projects/:projectId/progress', 'getPmProjectsByIdProgress', 'getPmProjectProgress', 'pm:projects:report', 'progress', 'Task counts and the share done, overall and per milestone.'],
  ['get', '/projects/:projectId/report', 'getPmProjectsByIdReport', 'getPmProjectReport', 'pm:projects:report', 'report', 'Tasks by status, hours, overdue work, workload per person and a burndown.'],
  ['get', '/projects/:projectId/members', 'getPmProjectsByIdMembers', 'listPmProjectMembers', 'pm:projects:read', 'listMembers', 'People on the project and their roles.'],
  ['post', '/projects/:projectId/members', 'postPmProjectsByIdMembers', 'addPmProjectMember', 'pm:projects:manage-members', 'addMember', 'Add an organization member to the project.'],
  ['patch', '/projects/:projectId/members/:userId', 'patchPmProjectsByIdMembersByUserId', 'updatePmProjectMember', 'pm:projects:manage-members', 'updateMember', 'Change a member role. A project always keeps a lead.'],
  ['delete', '/projects/:projectId/members/:userId', 'deletePmProjectsByIdMembersByUserId', 'removePmProjectMember', 'pm:projects:manage-members', 'removeMember', 'Remove a member; their open tasks become unassigned.'],
  ['post', '/projects/:projectId/milestones', 'postPmProjectsByIdMilestones', 'createPmMilestone', 'pm:projects:write', 'createMilestone', 'Add a milestone. Leads only.'],
  ['patch', '/projects/:projectId/milestones/:milestoneId', 'patchPmProjectsByIdMilestonesByMilestoneId', 'updatePmMilestone', 'pm:projects:write', 'updateMilestone', 'Rename, reschedule or complete a milestone.'],
  ['delete', '/projects/:projectId/milestones/:milestoneId', 'deletePmProjectsByIdMilestonesByMilestoneId', 'deletePmMilestone', 'pm:projects:write', 'deleteMilestone', 'Delete a milestone; its tasks keep existing.'],
  ['get', '/projects/:projectId/board', 'getPmProjectsByIdBoard', 'getPmBoard', 'pm:tasks:read', 'board', 'Kanban data: each column with its true count and the first cards.'],
  ['get', '/projects/:projectId/board/column', 'getPmProjectsByIdBoardColumn', 'getPmBoardColumn', 'pm:tasks:read', 'boardColumn', 'More cards for one column, continuing from a cursor.'],
  ['get', '/projects/:projectId/tasks', 'getPmProjectsByIdTasks', 'listPmTasks', 'pm:tasks:read', 'listTasks', 'List view with filters (status, priority, assigneeId, milestoneId, overdue, mine, q), sort and paging.'],
  ['post', '/projects/:projectId/tasks', 'postPmProjectsByIdTasks', 'createPmTask', 'pm:tasks:write', 'createTask', 'Create a task. Contributors and leads only.'],
  ['get', '/tasks/:taskId', 'getPmTasksById', 'getPmTask', 'pm:tasks:read', 'getTask', 'A task with subtasks, dependencies, people and counts.'],
  ['patch', '/tasks/:taskId', 'patchPmTasksById', 'updatePmTask', 'pm:tasks:write', 'updateTask', 'Edit a task. Send the version you read; a stale one answers 409 VERSION_CONFLICT.'],
  ['delete', '/tasks/:taskId', 'deletePmTasksById', 'deletePmTask', 'pm:tasks:write', 'deleteTask', 'Soft-delete a task and its subtasks.'],
  ['post', '/tasks/:taskId/move', 'postPmTasksByIdMove', 'movePmTask', 'pm:tasks:write', 'moveTask', 'Change column and position (kanban drag). Refused while blockers or subtasks are open.'],
  ['get', '/tasks/:taskId/attachments', 'getPmTasksByIdAttachments', 'listPmTaskAttachments', 'pm:tasks:read', 'listAttachments', 'Files attached to the task.'],
  ['post', '/tasks/:taskId/attachments', 'postPmTasksByIdAttachments', 'uploadPmTaskAttachment', 'pm:tasks:write', 'uploadAttachment', 'Attach a file (base64 in JSON, at most 3 MB, 20 per task). The type is checked from the bytes.', "express.json({ limit: '4500kb' })"],
  ['get', '/tasks/:taskId/attachments/:attachmentId/download', 'getPmTasksByIdAttachmentsByAttachmentIdDownload', 'downloadPmTaskAttachment', 'pm:tasks:read', 'downloadAttachment', 'The file itself, with safe headers. Images and PDFs open inline; everything else downloads.'],
  ['delete', '/tasks/:taskId/attachments/:attachmentId', 'deletePmTasksByIdAttachmentsByAttachmentId', 'deletePmTaskAttachment', 'pm:tasks:write', 'deleteAttachment', 'Remove a file. The uploader or a project lead.'],
  ['get', '/tasks/:taskId/time', 'getPmTasksByIdTime', 'listPmTaskTime', 'pm:tasks:read', 'listTime', 'Time logged on the task, with the total.'],
  ['post', '/tasks/:taskId/time', 'postPmTasksByIdTime', 'logPmTaskTime', 'pm:tasks:write', 'logTime', 'Log hours worked on a day. Not in the future, at most 24 hours a day.'],
  ['patch', '/tasks/:taskId/time/:entryId', 'patchPmTasksByIdTimeByEntryId', 'updatePmTaskTime', 'pm:tasks:write', 'updateTime', 'Change your own time entry.'],
  ['delete', '/tasks/:taskId/time/:entryId', 'deletePmTasksByIdTimeByEntryId', 'deletePmTaskTime', 'pm:tasks:write', 'deleteTime', 'Remove a time entry. Your own, or any for a project lead.'],
  ['get', '/tasks/:taskId/activity', 'getPmTasksByIdActivity', 'listPmTaskActivity', 'pm:tasks:read', 'taskActivity', 'Append-only history of changes to the task.'],
  ['get', '/tasks/:taskId/comments', 'getPmTasksByIdComments', 'listPmTaskComments', 'pm:tasks:read', 'listComments', 'Comments, oldest first.'],
  ['post', '/tasks/:taskId/comments', 'postPmTasksByIdComments', 'addPmTaskComment', 'pm:tasks:comment', 'addComment', 'Add a plain-text comment.'],
  ['patch', '/tasks/:taskId/comments/:commentId', 'patchPmTasksByIdCommentsByCommentId', 'editPmTaskComment', 'pm:tasks:comment', 'editComment', 'Edit your own comment.'],
  ['delete', '/tasks/:taskId/comments/:commentId', 'deletePmTasksByIdCommentsByCommentId', 'deletePmTaskComment', 'pm:tasks:read', 'deleteComment', 'Delete your own comment; a project lead may delete any.'],
  ['post', '/tasks/:taskId/dependencies', 'postPmTasksByIdDependencies', 'addPmTaskDependency', 'pm:tasks:write', 'addDependency', 'Make the task wait for another task in the same project. Loops are refused.'],
  ['delete', '/tasks/:taskId/dependencies/:dependsOnTaskId', 'deletePmTasksByIdDependenciesByDependsOnTaskId', 'removePmTaskDependency', 'pm:tasks:write', 'removeDependency', 'Remove a dependency.'],
  ['get', '/templates', 'getPmTemplates', 'listPmTemplates', 'pm:projects:read', 'listTemplates', 'Project templates of the organization.'],
  ['post', '/templates', 'postPmTemplates', 'createPmTemplate', 'pm:templates:manage', 'createTemplate', 'Create a template.'],
  ['post', '/templates/from-project/:projectId', 'postPmTemplatesFromProjectByProjectId', 'createPmTemplateFromProject', 'pm:templates:manage', 'templateFromProject', 'Save a project board, milestones and tasks as a template.'],
  ['get', '/templates/:templateId', 'getPmTemplatesById', 'getPmTemplate', 'pm:projects:read', 'getTemplate', 'One template.'],
  ['patch', '/templates/:templateId', 'patchPmTemplatesById', 'updatePmTemplate', 'pm:templates:manage', 'updateTemplate', 'Edit a template.'],
  ['delete', '/templates/:templateId', 'deletePmTemplatesById', 'deletePmTemplate', 'pm:templates:manage', 'deleteTemplate', 'Delete a template.'],
];

const STATUS = { post: '201', delete: '204' };
const swaggerPath = (p) => '/api/v1/pm' + p.replace(/:(\w+)/g, '{$1}');
const params = (p) => [...p.matchAll(/:(\w+)/g)].map((m) => m[1]);

const blocks = R.map(([method, p, op, summary, perm, handler, desc, pre]) => {
  const ps = params(p)
    .map((n) => ` *       - { in: path, name: ${n}, required: true, schema: { type: string, format: uuid } }`)
    .join('\n');
  const body = method === 'post' || method === 'patch' ? ' *     requestBody:\n *       content:\n *         application/json:\n *           schema: { type: object }\n' : '';
  const ok = STATUS[method] ?? '200';
  return `/**
 * @swagger
 * ${swaggerPath(p)}:
 *   ${method}:
 *     summary: ${summary}
 *     operationId: ${op}
 *     description: "${desc.replace(/"/g, "'")} Needs ${perm}."
 *     tags: [projectManagement]
 *     security:
 *       - bearerAuth: []
${ps ? ' *     parameters:\n' + ps + '\n' : ''}${body} *     responses:
 *       ${ok}: { description: Success }
 *       400: { description: Validation error }
 *       401: { description: Not signed in }
 *       403: { description: Missing permission or project role }
 *       404: { description: Not found, or not visible to you }
 */
router.${method}('${p}', requirePermission('${perm}'),${pre ? ' ' + pre + ',' : ''} controller.${handler});
`;
});

const file = `/**
 * GENERATED by scripts/gen-pm-routes.cjs. Edit the table there, not this file.
 */
import express, { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { PmController } from './pm.controller';

const router = Router();
const controller = new PmController();

router.use(authenticate);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A malformed id can never match a row, so answer 404 before it reaches the database.
for (const name of ['projectId', 'taskId', 'userId', 'milestoneId', 'commentId', 'dependsOnTaskId', 'templateId', 'attachmentId', 'entryId']) {
  router.param(name, (_req, _res, next, value) =>
    UUID.test(String(value)) ? next() : next(new AppError('Not found', 404, 'NOT_FOUND')),
  );
}

${blocks.join('\n')}
export default router;
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'modules', 'pm', 'pm.routes.ts'), file);
console.log('wrote', R.length, 'routes');
