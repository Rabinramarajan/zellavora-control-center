import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../services/auth/password.service';
import { DDL_SEED } from '../modules/ddl/ddl.data';
import { DdlRepository } from '../modules/ddl/ddl.repository';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  // 1. Create Default Tenant
  const tenant = await prisma.organization.upsert({
    where: { clientCode: 'zellavora-inc' },
    update: {},
    create: {
      name: 'Zellavora Inc',
      clientCode: 'zellavora-inc',
      logoUrl: null,
      plan: 'enterprise',
      enforce2fa: false,
    },
  });
  console.log(`- Tenant created: ${tenant.name} (${tenant.id})`);

  // 2. Create HQ Branch
  const branch = await prisma.branch.create({
    data: {
      organizationId: tenant.id,
      name: 'Primary HQ Office',
      code: 'HQ-001',
    },
  });
  console.log(`- Branch created: ${branch.name} (${branch.id})`);

  // 3. Create Super Admin User
  const passwordHash = await PasswordService.hash('AdminPassword123!');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@zellavora.com' },
    update: {},
    create: {
      email: 'admin@zellavora.com',
      emailId: 'admin@zellavora.com',
      username: 'superadmin',
      fullName: 'Super Administrator',
      passwordHash,
      role: 'owner',
      tenantId: tenant.id,
    },
  });
  console.log(`- Super Admin User created: ${adminUser.email}`);

  // Map User to Tenant
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: tenant.id,
      role: 'owner',
    },
  });

  // 4. Create Roles
  let ownerRole = await prisma.role.findFirst({
    where: { name: 'Owner', organizationId: tenant.id },
  });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: {
        name: 'Owner',
        key: `${tenant.id}_owner`,
        organizationId: tenant.id,
        description: 'Full workspace owner access controls',
      },
    });
  }

  let adminRole = await prisma.role.findFirst({
    where: { name: 'Admin', organizationId: tenant.id },
  });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: 'Admin',
        key: `${tenant.id}_admin`,
        organizationId: tenant.id,
        description: 'General system administration permissions',
      },
    });
  }

  let userRole = await prisma.role.findFirst({
    where: { name: 'User', organizationId: tenant.id },
  });
  if (!userRole) {
    userRole = await prisma.role.create({
      data: {
        name: 'User',
        key: `${tenant.id}_user`,
        organizationId: tenant.id,
        description: 'Standard operational team member privileges',
      },
    });
  }
  console.log('- Default security roles created');

  // 5. Create Permissions
  const permissionsData = [
    {
      name: 'read:dashboard',
      key: 'dashboard:read',
      resource: 'dashboard',
      action: 'read',
      description: 'View workspace monitoring metrics',
    },
    {
      name: 'write:settings',
      key: 'settings:write',
      resource: 'settings',
      action: 'write',
      description: 'Modify organization configuration settings',
    },
    {
      name: 'manage:users',
      key: 'users:manage',
      resource: 'users',
      action: 'manage',
      description: 'Provision and revoke system access roles',
    },
  ];

  const permissionsList = [];
  for (const perm of permissionsData) {
    const createdPerm = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
    permissionsList.push(createdPerm);
  }
  console.log('- Default system access permissions created');

  // 6. Map Permissions to Roles
  for (const perm of permissionsList) {
    const existing = await prisma.rolePermission.findFirst({
      where: {
        organizationId: tenant.id,
        roleId: ownerRole.id,
        permissionId: perm.id,
      },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          organizationId: tenant.id,
          roleId: ownerRole.id,
          permissionId: perm.id,
          effect: 'allow',
        },
      });
    }
  }
  console.log('- Mapped permissions to Owner role');

  // 7. Assign Owner Role to Admin User
  const existingAssignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: adminUser.id,
      roleId: ownerRole.id,
      organizationId: tenant.id,
    },
  });
  if (!existingAssignment) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: adminUser.id,
        roleId: ownerRole.id,
        organizationId: tenant.id,
        resourceType: 'tenant',
        resourceId: tenant.id,
      },
    });
  }
  console.log(`- Assigned Owner role to User: ${adminUser.email}`);

  // 8. Create a default invitation code for registration testing
  await prisma.invitation.upsert({
    where: { code: 'ZCC-INVITE-2026' },
    update: { used: false },
    create: {
      email: 'admin@zellavora.com',
      code: 'ZCC-INVITE-2026',
      used: false,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('- Default invitation code seeded: ZCC-INVITE-2026');

  // 9. Seed DDL lists (countries, languages, genders, etc.)
  const ddlRepo = new DdlRepository();
  for (const item of DDL_SEED) {
    await ddlRepo.upsert(item);
  }
  console.log(`- DDL lists seeded (${DDL_SEED.length} entries)`);

  console.log('✅ Seeding Completed Successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error Seeding Database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
