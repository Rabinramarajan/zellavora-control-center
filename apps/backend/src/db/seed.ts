import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../services/auth/password.service';
import { DDL_SEED } from '../modules/ddl/ddl.data';
import { DdlRepository } from '../modules/ddl/ddl.repository';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

    // 1. Create Default Tenant
    console.log('📦 Creating default organization...');
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
    console.log(`✅ Organization created: ${tenant.name} (${tenant.id})\n`);

  // 2. Create HQ Branch
  console.log('🏢 Creating branch...');
  const branch = await prisma.branch.create({
    data: {
      organizationId: tenant.id,
      name: 'Primary HQ Office',
      code: 'HQ-001',
    },
  });
  console.log(`✅ Branch created: ${branch.name}\n`);

  // 3. Create Super Admin User
  console.log('👤 Creating super admin user...');
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
  console.log(`✅ Admin user created: ${adminUser.fullName}\n`);

  // Map User to Tenant
  console.log('🔗 Mapping user to tenant...');
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
  console.log('✅ User-tenant mapping created\n');

  // 4. Create Roles
  console.log('👑 Creating roles...');
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
    console.log('  ✅ Owner role created');
  } else {
    console.log('  ⏭️  Owner role already exists');
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
    console.log('  ✅ Admin role created');
  } else {
    console.log('  ⏭️  Admin role already exists');
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
    console.log('  ✅ User role created');
  } else {
    console.log('  ⏭️  User role already exists');
  }
  console.log();

  // 5. Create Permissions
  console.log('🔐 Creating permissions...');
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
    console.log(`  ✅ Permission created: ${perm.name}`);
  }
  console.log();

  // 6. Map Permissions to Roles
  console.log('🔗 Mapping permissions to roles...');
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
      console.log(`  ✅ Permission assigned to Owner role`);
    }
  }
  console.log();

  // 7. Assign Owner Role to Admin User
  console.log('👥 Assigning roles to admin user...');
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
    console.log('  ✅ Owner role assigned to admin user');
  } else {
    console.log('  ⏭️  Admin user already has Owner role');
  }
  console.log();

  // 8. Create a default invitation code for registration testing
  console.log('🎟️  Creating invitation code...');
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
  console.log('  ✅ Invitation code created: ZCC-INVITE-2026\n');

  // 9. Seed DDL lists (countries, languages, genders, etc.)
  console.log('📋 Seeding DDL data (countries, languages, etc.)...');
  const ddlRepo = new DdlRepository();
  let ddlCount = 0;
  for (const item of DDL_SEED) {
    await ddlRepo.upsert(item);
    ddlCount++;
  }
  console.log(`  ✅ ${ddlCount} DDL items seeded\n`);

  console.log('✨ Database seeding completed successfully!');
  console.log('\n📖 Login credentials:');
  console.log('   Email: admin@zellavora.com');
  console.log('   Password: AdminPassword123!');
  console.log('   Invitation Code: ZCC-INVITE-2026\n');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
