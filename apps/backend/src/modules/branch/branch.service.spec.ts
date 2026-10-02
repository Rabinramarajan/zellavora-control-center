jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

import { BranchService, nextBranchCode } from './branch.service';
import type { BranchRepository } from './branch.repository';

const ORG = 'org';
const ACTOR = 'actor';

const branch = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  organizationId: ORG,
  code: 'BR-0001',
  name: `Branch ${id}`,
  isHeadOffice: false,
  address: null,
  city: null,
  state: null,
  country: null,
  pincode: null,
  phone: null,
  email: null,
  status: 'active',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeRepo = (existing = branch('b1')) => {
  const tx = {};
  return {
    findById: jest.fn(async () => existing),
    findByName: jest.fn(async () => null),
    userCounts: jest.fn(async () => new Map([[existing.id, 3]])),
    generatedCodes: jest.fn(async () => ['BR-0001', 'BR-0007', 'LEGACY-9']),
    lockOrganizationCodes: jest.fn(),
    clearHeadOffice: jest.fn(),
    create: jest.fn(async (data: Record<string, unknown>) => branch('new', data)),
    update: jest.fn(),
    softDelete: jest.fn(),
    transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as jest.Mocked<BranchRepository>;
};

describe('nextBranchCode', () => {
  it('starts at BR-0001 for an organization without branches', () => {
    expect(nextBranchCode([])).toBe('BR-0001');
  });

  it('continues after the highest generated code and ignores foreign formats', () => {
    expect(nextBranchCode(['BR-0002', 'BR-0010', 'HQ-001', 'BR-x'])).toBe('BR-0011');
  });

  it('grows past four digits instead of wrapping', () => {
    expect(nextBranchCode(['BR-9999'])).toBe('BR-10000');
  });
});

describe('BranchService', () => {
  it('generates the code under the per-organization lock', async () => {
    const repo = makeRepo();
    await new BranchService(repo).create(
      ORG,
      { name: 'Chennai', isHeadOffice: false, status: 'active' },
      ACTOR
    );
    expect(repo.lockOrganizationCodes).toHaveBeenCalledWith(ORG, expect.anything());
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BR-0008', name: 'Chennai', createdBy: ACTOR }),
      expect.anything()
    );
  });

  it('rejects a duplicate branch name', async () => {
    const repo = makeRepo();
    repo.findByName.mockResolvedValueOnce(branch('other') as never);
    await expect(
      new BranchService(repo).create(
        ORG,
        { name: 'Branch other', isHeadOffice: false, status: 'active' },
        ACTOR
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('demotes the previous head office when a new one is created', async () => {
    const repo = makeRepo();
    await new BranchService(repo).create(
      ORG,
      { name: 'HQ', isHeadOffice: true, status: 'active' },
      ACTOR
    );
    expect(repo.clearHeadOffice).toHaveBeenCalledWith(ORG, null, expect.anything());
  });

  it('never lets an update change the code', async () => {
    const repo = makeRepo();
    await new BranchService(repo).update(ORG, 'b1', { name: 'Renamed', city: '' }, ACTOR);
    const data = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(data).not.toHaveProperty('code');
    expect(data).toMatchObject({ name: 'Renamed', city: null, updatedBy: ACTOR });
  });

  it('refuses to delete the head office', async () => {
    const repo = makeRepo(branch('hq', { isHeadOffice: true }));
    await expect(new BranchService(repo).remove(ORG, 'hq', ACTOR)).rejects.toMatchObject({
      status: 409,
    });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes an ordinary branch', async () => {
    const repo = makeRepo();
    await expect(new BranchService(repo).remove(ORG, 'b1', ACTOR)).resolves.toEqual({
      success: true,
    });
    expect(repo.softDelete).toHaveBeenCalledWith('b1', ORG, ACTOR, expect.anything());
  });

  it('returns 404 for a branch outside the organization', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValueOnce(null as never);
    await expect(new BranchService(repo).get(ORG, 'missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
