/**
 * Grant one user media library access (media:upload, media:delete) in every
 * organization they belong to, through a "Media Manager" role.
 *
 *   npm run db:grant-media -- someone@example.com
 *
 * Safe to re-run: every step checks for existing rows first.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MEDIA_PERMISSIONS = [
  {
    name: 'upload:media',
    key: 'media:upload',
    resource: 'media',
    action: 'upload',
    description: 'Upload files to the media library',
  },
  {
    name: 'delete:media',
    key: 'media:delete',
    resource: 'media',
    action: 'delete',
    description: 'Delete files from the media library',
  },
];

async function assignRole(
  userId: string,
  roleId: string,
  organizationId: string
): Promise<boolean> {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { userId, roleId, organizationId },
  });
  if (existing) return false;
  await prisma.userRoleAssignment.create({
    data: { userId, roleId, organizationId, resourceType: 'tenant', resourceId: organizationId },
  });
  return true;
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run db:grant-media -- <email>');

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new Error(`No user with email ${email}`);

  const permissions = [];
  for (const perm of MEDIA_PERMISSIONS) {
    permissions.push(
      await prisma.permission.upsert({ where: { key: perm.key }, update: {}, create: perm })
    );
  }

  const memberships = await prisma.userTenant.findMany({
    where: { userId: user.id },
    include: { tenant: { select: { name: true } } },
  });
  if (!memberships.length) throw new Error(`${email} is not a member of any organization`);

  for (const { tenantId, tenant } of memberships) {
    console.log(`📦 ${tenant.name}`);

    // PermissionService only falls back to the role named after user.role when the
    // user has no explicit assignments. Assign it explicitly so adding Media Manager
    // doesn't silently drop the permissions (and menus) the user has today.
    const assignmentCount = await prisma.userRoleAssignment.count({
      where: { userId: user.id, organizationId: tenantId },
    });
    if (!assignmentCount) {
      const fallbackRole = await prisma.role.findFirst({
        where: { name: { equals: user.role, mode: 'insensitive' }, organizationId: tenantId },
      });
      if (fallbackRole && (await assignRole(user.id, fallbackRole.id, tenantId))) {
        console.log(`  ✅ Kept existing access: assigned ${fallbackRole.name} role`);
      }
    }

    const role =
      (await prisma.role.findFirst({
        where: { name: 'Media Manager', organizationId: tenantId },
      })) ??
      (await prisma.role.create({
        data: {
          name: 'Media Manager',
          key: `${tenantId}_media_manager`,
          organizationId: tenantId,
          description: 'Upload and delete files in the media library',
        },
      }));

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { effect: 'allow' },
        create: {
          organizationId: tenantId,
          roleId: role.id,
          permissionId: permission.id,
          effect: 'allow',
        },
      });
    }

    const added = await assignRole(user.id, role.id, tenantId);
    console.log(
      added ? '  ✅ Media Manager role assigned' : '  ⏭️  Media Manager role already assigned'
    );
  }

  console.log(
    `\n✨ ${user.email} can now upload and delete media. Sign out and back in to refresh the session.`
  );
}

main()
  .catch((error) => {
    console.error('❌', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
