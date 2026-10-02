import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { TxClient } from '../../infrastructure/prisma';
import { BRANCH_CODE_PREFIX, BranchRepository } from './branch.repository';
import { BranchListQuery, BranchStatus, CreateBranchDto, UpdateBranchDto } from './branch.dto';

type BranchRow = NonNullable<Awaited<ReturnType<BranchRepository['findById']>>>;

const CODE_DIGITS = 4;
const CODE_PATTERN = new RegExp(`^${BRANCH_CODE_PREFIX}(\\d+)$`);

/** Next sequential code after the highest one ever issued, e.g. BR-0001, BR-0002 … */
export const nextBranchCode = (existing: readonly string[]): string => {
  const highest = existing.reduce((max, code) => {
    const match = CODE_PATTERN.exec(code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${BRANCH_CODE_PREFIX}${String(highest + 1).padStart(CODE_DIGITS, '0')}`;
};

const blankToNull = (value: string | null | undefined) => (value ? value : null);

const toView = (b: BranchRow, userCount = 0) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  isHeadOffice: b.isHeadOffice,
  address: b.address,
  city: b.city,
  state: b.state,
  country: b.country,
  pincode: b.pincode,
  phone: b.phone,
  email: b.email,
  status: b.status as BranchStatus,
  userCount,
  version: b.version,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

export class BranchService {
  constructor(private readonly repo = new BranchRepository()) {}

  async list(organizationId: string, query: BranchListQuery) {
    const { data, total } = await this.repo.list(organizationId, query);
    const counts = await this.repo.userCounts(data.map((b) => b.id));
    return {
      data: data.map((b) => toView(b, counts.get(b.id))),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(organizationId: string, id: string) {
    const branch = await this.require(organizationId, id);
    const counts = await this.repo.userCounts([id]);
    return toView(branch, counts.get(id));
  }

  async create(organizationId: string, dto: CreateBranchDto, actorId: string) {
    await this.assertNameFree(organizationId, dto.name);
    const created = await this.repo.transaction(async (tx) => {
      await this.repo.lockOrganizationCodes(organizationId, tx);
      const code = nextBranchCode(await this.repo.generatedCodes(organizationId, tx));
      if (dto.isHeadOffice) await this.repo.clearHeadOffice(organizationId, null, tx);
      return this.repo.create(
        {
          organizationId,
          code,
          ...this.fields(dto),
          name: dto.name,
          isHeadOffice: dto.isHeadOffice,
          status: dto.status,
          createdBy: actorId,
          updatedBy: actorId,
        },
        tx
      );
    });
    await this.audit(organizationId, actorId, 'branch.created', created.id, {
      after: { ...dto, code: created.code },
    });
    return this.get(organizationId, created.id);
  }

  async update(organizationId: string, id: string, dto: UpdateBranchDto, actorId: string) {
    const existing = await this.require(organizationId, id);
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(organizationId, dto.name);
    }
    if (existing.isHeadOffice && dto.isHeadOffice === false) {
      throw new AppError(
        'Mark another branch as head office instead of clearing it here.',
        409,
        'BRANCH_HEAD_OFFICE_REQUIRED'
      );
    }
    await this.repo.transaction(async (tx: TxClient) => {
      if (dto.isHeadOffice) await this.repo.clearHeadOffice(organizationId, id, tx);
      await this.repo.update(
        id,
        {
          ...this.fields(dto),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.isHeadOffice !== undefined && { isHeadOffice: dto.isHeadOffice }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: actorId,
        },
        tx
      );
    });
    await this.audit(organizationId, actorId, 'branch.updated', id, {
      before: {
        name: existing.name,
        status: existing.status,
        isHeadOffice: existing.isHeadOffice,
      },
      after: dto,
    });
    return this.get(organizationId, id);
  }

  async remove(organizationId: string, id: string, actorId: string) {
    const existing = await this.require(organizationId, id);
    if (existing.isHeadOffice) {
      throw new AppError(
        'The head office cannot be deleted. Mark another branch as head office first.',
        409,
        'BRANCH_IS_HEAD_OFFICE'
      );
    }
    await this.repo.transaction((tx) => this.repo.softDelete(id, organizationId, actorId, tx));
    await this.audit(organizationId, actorId, 'branch.deleted', id, {
      before: { code: existing.code, name: existing.name },
    });
    return { success: true };
  }

  /** Optional contact/address fields, only those present on the DTO. */
  private fields(dto: UpdateBranchDto) {
    const keys = ['address', 'city', 'state', 'country', 'pincode', 'phone', 'email'] as const;
    return Object.fromEntries(
      keys.filter((k) => dto[k] !== undefined).map((k) => [k, blankToNull(dto[k])])
    );
  }

  private async require(organizationId: string, id: string) {
    const branch = await this.repo.findById(id, organizationId);
    if (!branch) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
    return branch;
  }

  private async assertNameFree(organizationId: string, name: string) {
    if (await this.repo.findByName(organizationId, name)) {
      throw new AppError(`A branch named '${name}' already exists.`, 409, 'BRANCH_EXISTS');
    }
  }

  private audit(
    organizationId: string,
    actorId: string,
    action: string,
    resourceId: string,
    detail: { before?: object; after?: object }
  ) {
    return AuditService.log({
      organizationId,
      actorId,
      action,
      resource: 'branch',
      resourceId,
      before: detail.before as Record<string, unknown> | undefined,
      after: detail.after as Record<string, unknown> | undefined,
    });
  }
}
