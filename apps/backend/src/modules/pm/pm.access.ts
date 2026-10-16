import type { PmMemberRole, PmProject, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { PermissionService } from '../../services/auth/permission.service';
import type { Column } from './pm.dto';

/** Who is asking: the verified token plus the permissions loaded for this request. */
export interface PmActor {
  userId: string;
  organizationId: string;
  permissions: Set<string>;
}

export const can = (actor: PmActor, code: string): boolean =>
  PermissionService.has(actor.permissions, code);

export const requireCan = (actor: PmActor, code: string): void => {
  if (!can(actor, code)) throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
};

const RANK: Record<PmMemberRole, number> = { VIEWER: 1, CONTRIBUTOR: 2, PM_LEAD: 3 };

export const atLeast = (role: PmMemberRole | null, needed: PmMemberRole): boolean =>
  role !== null && RANK[role] >= RANK[needed];

export const projectNotFound = (): AppError =>
  new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
export const taskNotFound = (): AppError => new AppError('Task not found', 404, 'TASK_NOT_FOUND');

export interface ProjectView {
  project: PmProject;
  /** The caller's role on this project, or null when they cannot see it at all. */
  role: PmMemberRole | null;
  columns: Column[];
}

export const columnsOf = (project: Pick<PmProject, 'columns'>): Column[] =>
  project.columns as unknown as Column[];

/**
 * Pure rule for what a caller may do on a project.
 *
 *  - A member gets their own role; the owner is always PM_LEAD.
 *  - PRIVATE projects are visible to members only, administrators included.
 *  - TEAM projects add members of the linked team, ORG projects add everyone with project access.
 *    Those readers are VIEWERs, except that holders of pm:projects:write lead any project they can see.
 */
export function resolveRole(input: {
  project: Pick<PmProject, 'ownerId' | 'visibility' | 'teamId'>;
  memberRole: PmMemberRole | null;
  userId: string;
  inProjectTeam: boolean;
  canWriteProjects: boolean;
}): PmMemberRole | null {
  const { project, memberRole, userId, inProjectTeam, canWriteProjects } = input;
  if (project.ownerId === userId) return 'PM_LEAD';
  if (memberRole) return memberRole;
  const visible = project.visibility === 'ORG' || (project.visibility === 'TEAM' && inProjectTeam);
  if (!visible) return null;
  return canWriteProjects ? 'PM_LEAD' : 'VIEWER';
}

/** Where clause for the projects a user may see. */
export function visibleProjectsWhere(
  actor: PmActor,
  teamIds: string[]
): Prisma.PmProjectWhereInput {
  return {
    organizationId: actor.organizationId,
    isDeleted: false,
    OR: [
      { ownerId: actor.userId },
      { members: { some: { userId: actor.userId } } },
      { visibility: 'ORG' },
      ...(teamIds.length ? [{ visibility: 'TEAM' as const, teamId: { in: teamIds } }] : []),
    ],
  };
}

export const doneKeys = (columns: Column[]): string[] =>
  columns.filter((c) => c.done).map((c) => c.key);
