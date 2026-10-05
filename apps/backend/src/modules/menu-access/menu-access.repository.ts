import { prisma, type TxClient } from '../../infrastructure/prisma';

const NAVIGATION_PREFIX = 'navigation:';

/** Data access for a role's navigation grants. */
export class MenuAccessRepository {
  findRole(roleId: string) {
    return prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, key: true, isSystem: true, organizationId: true },
    });
  }

  /** Every allowed permission key on the role, navigation and otherwise. */
  async allowedKeys(roleId: string, organizationId: string): Promise<string[]> {
    const rows = await prisma.rolePermission.findMany({
      where: { roleId, organizationId, effect: 'allow' },
      select: { permission: { select: { key: true } } },
    });
    return rows.map((row) => row.permission.key);
  }

  permissionsByKey(keys: readonly string[], tx: TxClient) {
    return tx.permission.findMany({
      where: { key: { in: [...keys] } },
      select: { id: true, key: true },
    });
  }

  /** Replace only the navigation grants; every other permission is untouched. */
  async replaceNavigation(
    roleId: string,
    organizationId: string,
    permissionIds: readonly string[],
    tx: TxClient
  ): Promise<void> {
    await tx.rolePermission.deleteMany({
      where: {
        roleId,
        organizationId,
        permission: { key: { startsWith: NAVIGATION_PREFIX } },
      },
    });
    if (permissionIds.length) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          organizationId,
          permissionId,
          effect: 'allow',
        })),
        skipDuplicates: true,
      });
    }
  }

  touchRole(roleId: string, actorId: string, tx: TxClient) {
    return tx.role.update({ where: { id: roleId }, data: { updatedBy: actorId } });
  }

  transaction<T>(work: (tx: TxClient) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => work(tx as TxClient));
  }
}
