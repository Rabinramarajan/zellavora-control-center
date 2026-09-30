import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class SecurityPolicyRepository extends BaseRepository {
  findSettings(organizationId: string, keys: string[], tx?: TxClient) {
    return this.getDb(tx).organizationSettings.findMany({
      where: { organizationId, key: { in: keys } },
    });
  }

  upsertSetting(organizationId: string, key: string, value: string, tx?: TxClient) {
    return this.getDb(tx).organizationSettings.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { value, category: 'security' },
      create: { organizationId, key, value, category: 'security' },
    });
  }

  findOrganization(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).organization.findUnique({
      where: { id: organizationId },
      select: { id: true, enforce2fa: true },
    });
  }

  setEnforce2fa(organizationId: string, enforce: boolean, actorId: string | null, tx?: TxClient) {
    return this.getDb(tx).organization.update({
      where: { id: organizationId },
      data: { enforce2fa: enforce, updatedBy: actorId },
    });
  }

  private memberWhere(organizationId: string, enrolled?: boolean): Prisma.UserWhereInput {
    return {
      isDeleted: false,
      userTenants: { some: { tenantId: organizationId } },
      ...(enrolled === undefined ? {} : { mfaEnabled: enrolled }),
    };
  }

  countMembers(organizationId: string, enrolled?: boolean, tx?: TxClient) {
    return this.getDb(tx).user.count({ where: this.memberWhere(organizationId, enrolled) });
  }

  listMembers(
    organizationId: string,
    query: { enrolled?: boolean; page: number; pageSize: number },
    tx?: TxClient
  ) {
    return this.getDb(tx).user.findMany({
      where: this.memberWhere(organizationId, query.enrolled),
      select: {
        id: true,
        fullName: true,
        email: true,
        mfaEnabled: true,
        mfaMethod: true,
        mfaEnrolledAt: true,
        lastLoginDatetime: true,
      },
      orderBy: [{ mfaEnabled: 'asc' }, { fullName: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  }
}
