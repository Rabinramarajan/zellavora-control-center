import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../services/auth/password.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  // 1. Create Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { clientCode: 'zellavora-inc' },
    update: {},
    create: {
      name: 'Zellavora Inc',
      clientCode: 'zellavora-inc',
      logoUrl: null,
      plan: 'enterprise',
      enforce2fa: true,
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
    },
  });

  // 4. Create Roles
  const ownerRole = await prisma.role.create({
    data: {
      name: 'Owner',
      organizationId: tenant.id,
      description: 'Full workspace owner access controls',
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      organizationId: tenant.id,
      description: 'General system administration permissions',
    },
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'User',
      organizationId: tenant.id,
      description: 'Standard operational team member privileges',
    },
  });
  console.log('- Default security roles created');

  // 5. Create Permissions
  const permissionsData = [
    { name: 'read:dashboard', description: 'View workspace monitoring metrics' },
    { name: 'write:settings', description: 'Modify organization configuration settings' },
    { name: 'manage:users', description: 'Provision and revoke system access roles' },
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
    await prisma.rolePermission.create({
      data: {
        roleId: ownerRole.id,
        permissionId: perm.id,
        effect: 'allow',
      },
    });
  }
  console.log('- Mapped permissions to Owner role');

  // 7. Assign Owner Role to Admin User
  await prisma.userRoleAssignment.create({
    data: {
      userId: adminUser.id,
      roleId: ownerRole.id,
      organizationId: tenant.id,
      resourceType: 'tenant',
      resourceId: tenant.id,
    },
  });
  console.log(`- Assigned Owner role to User: ${adminUser.email}`);

  // 8. Create a default invitation code for registration testing
  await prisma.invitation.upsert({
    where: { email: 'admin@zellavora.com' },
    update: { used: false },
    create: {
      email: 'admin@zellavora.com',
      code: 'ZCC-INVITE-2026',
      used: false,
    },
  });
  console.log('- Default invitation code seeded: ZCC-INVITE-2026');

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
