import { applyRequest, AccessState, EMPTY_ACCESS } from './user-request.access';
import { RequestPayloadSchema } from './user-request.dto';
import { validateForSubmit } from './user-request.service';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const payload = (input: Record<string, unknown> = {}) => RequestPayloadSchema.parse(input);

const current: AccessState = {
  branchId: id(1),
  departmentId: id(2),
  teamIds: [id(3)],
  groupIds: [id(10), id(11)],
  roleIds: [id(20), id(21)],
  accessScope: null,
};

describe('applyRequest', () => {
  it('builds access from scratch for a new user', () => {
    const result = applyRequest(
      EMPTY_ACCESS,
      'NEW_USER',
      payload({
        organization: {
          branchId: id(1),
          departmentId: id(2),
          teamId: id(3),
          accessScope: 'BRANCH',
        },
        access: { addGroupIds: [id(10)], addRoleIds: [id(20)] },
      })
    );
    expect(result).toEqual({
      branchId: id(1),
      departmentId: id(2),
      teamIds: [id(3)],
      groupIds: [id(10)],
      roleIds: [id(20)],
      accessScope: 'BRANCH',
    });
  });

  it('adds and removes roles and groups for an access change', () => {
    const result = applyRequest(
      current,
      'ACCESS_CHANGE',
      payload({
        access: { addRoleIds: [id(22)], removeRoleIds: [id(20)], removeGroupIds: [id(11)] },
      })
    );
    expect(result.roleIds).toEqual([id(21), id(22)]);
    expect(result.groupIds).toEqual([id(10)]);
    expect(result.branchId).toBe(id(1));
  });

  it('only honours the matching side for single-purpose types', () => {
    const p = payload({ access: { addRoleIds: [id(22)], removeRoleIds: [id(20)] } });
    expect(applyRequest(current, 'ADD_ROLE', p).roleIds).toEqual([id(20), id(21), id(22)]);
    expect(applyRequest(current, 'REMOVE_ROLE', p).roleIds).toEqual([id(21)]);
    expect(applyRequest(current, 'ADD_GROUP', p).roleIds).toEqual(current.roleIds);
  });

  it('moves branch and team on transfer without touching untouched fields', () => {
    const result = applyRequest(
      current,
      'TRANSFER',
      payload({ organization: { branchId: id(5), teamId: id(6) } })
    );
    expect(result.branchId).toBe(id(5));
    expect(result.teamIds).toEqual([id(6)]);
    expect(result.departmentId).toBe(id(2));
  });

  it('leaves access unchanged for account-state requests', () => {
    expect(
      applyRequest(current, 'UNLOCK_ACCOUNT', payload({ access: { addRoleIds: [id(22)] } }))
    ).toEqual(current);
  });
});

describe('validateForSubmit', () => {
  it('lists every missing mandatory field for a new user', () => {
    const errors = validateForSubmit('NEW_USER', payload(), null);
    expect(errors).toEqual(
      expect.arrayContaining([
        'Username is required',
        'First Name is required',
        'Last Name is required',
        'User Type is required',
        'Employee Code is required',
        'Employment Type is required',
        'Work Email is required',
        'Branch is required',
        'Department is required',
      ])
    );
  });

  it('accepts a complete new user request', () => {
    const errors = validateForSubmit(
      'NEW_USER',
      payload({
        user: {
          username: 'eric.parker',
          firstName: 'Eric',
          lastName: 'Parker',
          userType: 'EMPLOYEE',
        },
        employee: { employeeCode: 'EMP00236', employmentType: 'PERMANENT' },
        contact: { workEmail: 'eric.parker@company.com' },
        organization: { branchId: id(1), departmentId: id(2) },
      }),
      null
    );
    expect(errors).toEqual([]);
  });

  it('requires a target user for changes to existing accounts', () => {
    expect(validateForSubmit('DEACTIVATE_USER', payload(), null)).toContain(
      'Requested For (existing user) is required'
    );
    expect(validateForSubmit('DEACTIVATE_USER', payload(), id(99))).toEqual([]);
  });

  it('rejects empty and contradictory access changes', () => {
    expect(validateForSubmit('ACCESS_CHANGE', payload(), id(99))).toContain(
      'Add or remove at least one group or role'
    );
    expect(
      validateForSubmit(
        'ACCESS_CHANGE',
        payload({ access: { addRoleIds: [id(1)], removeRoleIds: [id(1)] } }),
        id(99)
      )
    ).toContain('A role cannot be both added and removed');
  });
});

describe('RequestPayloadSchema', () => {
  it('enforces name length and username format', () => {
    expect(() => payload({ user: { firstName: 'E' } })).toThrow();
    expect(() => payload({ user: { username: 'Eric Parker' } })).toThrow();
  });
});
