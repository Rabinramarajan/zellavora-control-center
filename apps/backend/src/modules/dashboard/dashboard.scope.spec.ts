import { resolveScope, scopeCacheKey } from './dashboard.scope';
import { INDIVIDUAL_ROLE_NAME } from '../auth/individual-role';
import { AppError } from '../../middleware/error';
import type { AuthRequest } from '../../middleware/auth';

const ORG = '11111111-1111-1111-1111-111111111111';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const req = (over: Partial<AuthRequest>): AuthRequest => over as AuthRequest;

describe('resolveScope', () => {
  it('scopes an organization account to its tenant only', () => {
    const scope = resolveScope(req({ userId: USER_A, tenantId: ORG, role: 'admin' }));
    expect(scope).toEqual({ kind: 'organization', organizationId: ORG });
  });

  it('narrows an individual account to its own user id', () => {
    const scope = resolveScope(
      req({ userId: USER_A, tenantId: ORG, role: INDIVIDUAL_ROLE_NAME })
    );
    expect(scope).toEqual({ kind: 'individual', organizationId: ORG, userId: USER_A });
  });

  it('rejects a request with no verified identity', () => {
    expect(() => resolveScope(req({ role: 'admin' }))).toThrow(AppError);
  });

  it('ignores a client-supplied tenant header and uses the token claim', () => {
    const scope = resolveScope(
      req({
        userId: USER_A,
        tenantId: ORG,
        role: 'admin',
        headers: { 'x-tenant-id': 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
      })
    );
    expect(scope).toEqual({ kind: 'organization', organizationId: ORG });
  });
});

describe('scopeCacheKey', () => {
  it('separates two individuals who share the default organization', () => {
    const a = scopeCacheKey({ kind: 'individual', organizationId: ORG, userId: USER_A });
    const b = scopeCacheKey({ kind: 'individual', organizationId: ORG, userId: USER_B });
    expect(a).not.toEqual(b);
  });

  it('separates an individual from the organization view of the same tenant', () => {
    const individual = scopeCacheKey({
      kind: 'individual',
      organizationId: ORG,
      userId: USER_A,
    });
    const organization = scopeCacheKey({ kind: 'organization', organizationId: ORG });
    expect(individual).not.toEqual(organization);
  });
});
