import { atLeast, resolveRole, visibleProjectsWhere, doneKeys } from './pm.access';
import {
  ColumnsSchema,
  CreateProjectSchema,
  CreateTaskSchema,
  DEFAULT_COLUMNS,
  UpdateTaskSchema,
  BulkUpdateSchema,
  CreateTemplateSchema,
  plainText,
} from './pm.dto';
import { presentTask } from './tasks.service';
import type { PmTask } from '@prisma/client';

const project = (
  over: Partial<{
    ownerId: string;
    visibility: 'PRIVATE' | 'TEAM' | 'ORG';
    teamId: string | null;
  }> = {}
) => ({
  ownerId: 'owner',
  visibility: 'PRIVATE' as const,
  teamId: null,
  ...over,
});
const role = (over: Partial<Parameters<typeof resolveRole>[0]> = {}) =>
  resolveRole({
    project: project(),
    memberRole: null,
    userId: 'me',
    inProjectTeam: false,
    canWriteProjects: false,
    ...over,
  });

describe('resolveRole', () => {
  it('makes the owner a lead whatever the membership row says', () => {
    expect(role({ userId: 'owner', memberRole: 'VIEWER' })).toBe('PM_LEAD');
  });

  it('uses the member role', () => {
    expect(role({ memberRole: 'CONTRIBUTOR' })).toBe('CONTRIBUTOR');
  });

  it('hides a private project from everyone else, administrators included', () => {
    expect(role()).toBeNull();
    expect(role({ canWriteProjects: true })).toBeNull();
  });

  it('shows an ORG project to readers as viewers', () => {
    expect(role({ project: project({ visibility: 'ORG' }) })).toBe('VIEWER');
  });

  it('lets a holder of pm:projects:write lead any project they can see', () => {
    expect(role({ project: project({ visibility: 'ORG' }), canWriteProjects: true })).toBe(
      'PM_LEAD'
    );
  });

  it('shows a TEAM project only to members of the team', () => {
    const team = project({ visibility: 'TEAM', teamId: 't1' });
    expect(role({ project: team })).toBeNull();
    expect(role({ project: team, inProjectTeam: true })).toBe('VIEWER');
  });
});

describe('atLeast', () => {
  it('orders the roles', () => {
    expect(atLeast('PM_LEAD', 'CONTRIBUTOR')).toBe(true);
    expect(atLeast('CONTRIBUTOR', 'CONTRIBUTOR')).toBe(true);
    expect(atLeast('VIEWER', 'CONTRIBUTOR')).toBe(false);
    expect(atLeast(null, 'VIEWER')).toBe(false);
  });
});

describe('visibleProjectsWhere', () => {
  const actor = { userId: 'me', organizationId: 'org', permissions: new Set<string>() };

  it('always scopes to the organization and skips deleted projects', () => {
    expect(visibleProjectsWhere(actor, [])).toMatchObject({
      organizationId: 'org',
      isDeleted: false,
    });
  });

  it('only includes team projects when the user is on a team', () => {
    const without = JSON.stringify(visibleProjectsWhere(actor, []));
    const withTeam = JSON.stringify(visibleProjectsWhere(actor, ['t1']));
    expect(without).not.toContain('TEAM');
    expect(withTeam).toContain('TEAM');
  });
});

describe('board columns', () => {
  it('accepts the default board', () => {
    expect(ColumnsSchema.safeParse(DEFAULT_COLUMNS).success).toBe(true);
    expect(doneKeys(DEFAULT_COLUMNS)).toEqual(['DONE']);
  });

  it.each([
    ['fewer than two columns', [{ key: 'A', label: 'A', done: true }]],
    [
      'duplicate keys',
      [
        { key: 'A', label: 'A', done: false },
        { key: 'A', label: 'B', done: true },
      ],
    ],
    [
      'no done column',
      [
        { key: 'A', label: 'A', done: false },
        { key: 'B', label: 'B', done: false },
      ],
    ],
    [
      'a lowercase key',
      [
        { key: 'todo', label: 'T', done: false },
        { key: 'DONE', label: 'D', done: true },
      ],
    ],
  ])('rejects %s', (_label, columns) => {
    expect(ColumnsSchema.safeParse(columns).success).toBe(false);
  });
});

describe('project and task input', () => {
  it('upper-cases and validates the project key', () => {
    expect(CreateProjectSchema.parse({ key: 'web', name: 'Website' }).key).toBe('WEB');
    expect(CreateProjectSchema.safeParse({ key: '1web', name: 'Website' }).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ key: 'W', name: 'Website' }).success).toBe(false);
  });

  it('refuses fields outside the allow-list', () => {
    expect(
      CreateProjectSchema.safeParse({ key: 'WEB', name: 'Site', organizationId: 'x' }).success
    ).toBe(false);
    expect(CreateTaskSchema.safeParse({ title: 'T', reporterId: 'x' }).success).toBe(false);
  });

  it('strips control characters from free text but keeps markup as text', () => {
    expect(plainText(50).parse('a\u0000b\u0007 <i>c</i>\n')).toBe('ab <i>c</i>');
    expect(plainText(3).safeParse('abcd').success).toBe(false);
  });

  it('requires the version on every task edit', () => {
    expect(UpdateTaskSchema.safeParse({ title: 'New' }).success).toBe(false);
    expect(UpdateTaskSchema.safeParse({ version: 2, title: 'New' }).success).toBe(true);
  });

  it('treats an empty date as clearing it', () => {
    expect(UpdateTaskSchema.parse({ version: 1, dueDate: '' }).dueDate).toBeNull();
  });

  it('caps bulk updates and rejects an empty change', () => {
    const ids = Array.from(
      { length: 101 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    );
    expect(BulkUpdateSchema.safeParse({ taskIds: ids, changes: { priority: 'LOW' } }).success).toBe(
      false
    );
    expect(BulkUpdateSchema.safeParse({ taskIds: ids.slice(0, 2), changes: {} }).success).toBe(
      false
    );
  });

  it('defaults a template to the default board', () => {
    const parsed = CreateTemplateSchema.parse({ name: 'Standard', definition: {} });
    expect(parsed.definition.columns).toEqual(DEFAULT_COLUMNS);
    expect(parsed.definition.tasks).toEqual([]);
  });
});

describe('presentTask', () => {
  const base = {
    id: 't',
    projectId: 'p',
    number: 7,
    title: 'T',
    status: 'TODO',
    priority: 'MEDIUM',
    version: 3,
    estimateHours: null,
    position: '1000',
    dueDate: new Date('2020-01-01T00:00:00Z'),
  } as unknown as PmTask;

  it('builds the human key and flags overdue open work', () => {
    const view = presentTask(base, 'WEB', new Set(['DONE']));
    expect(view.key).toBe('WEB-7');
    expect(view.overdue).toBe(true);
    expect(view.position).toBe(1000);
  });

  it('does not flag finished work as overdue', () => {
    expect(presentTask({ ...base, status: 'DONE' }, 'WEB', new Set(['DONE'])).overdue).toBe(false);
  });

  it('derives a parent progress from its subtasks', () => {
    const view = presentTask(base, 'WEB', new Set(['DONE']), { childCount: 4, childDone: 1 });
    expect(view.progress).toBe(25);
    expect(
      presentTask(base, 'WEB', new Set(['DONE']), { childCount: 0, childDone: 0 }).progress
    ).toBeNull();
  });
});
