import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../services/auth/password.service';

const prisma = new PrismaClient();

const EMAIL = 'rabinrstack@gmail.com';
const PASSWORD = process.env.FREELANCER_PASSWORD ?? 'Rabin@12345678';

// navigation:restricted limits the sidebar to nodes explicitly granted via
// navigation:<menu-key>; children of a granted node are shown automatically.
const FREELANCER_PERMISSIONS = [
  { name: 'read:dashboard', key: 'dashboard:read', resource: 'dashboard', action: 'read', description: 'View workspace monitoring metrics' },
  { name: 'approve:timesheet', key: 'timesheet:approve', resource: 'timesheet', action: 'approve', description: "Review, approve, reject and mark paid other people's timesheets and sheets" },
  { name: 'navigation:restricted', key: 'navigation:restricted', resource: 'navigation', action: 'restricted', description: 'Only show explicitly granted menu entries' },
  { name: 'navigation:dashboard', key: 'navigation:dashboard', resource: 'navigation', action: 'dashboard', description: 'Show the Dashboard menu entry' },
  { name: 'navigation:freelancer-sheets', key: 'navigation:freelancer-sheets', resource: 'navigation', action: 'freelancer-sheets', description: 'Show the Freelancer Sheets menu entry' },
];

async function main() {
  const organization = await prisma.organization.findUnique({
    where: { clientCode: 'zellavora-inc' },
  });
  if (!organization) {
    throw new Error('Organization not found. Please run main seed first.');
  }

  let role = await prisma.role.findFirst({
    where: { name: 'Freelancer', organizationId: organization.id },
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: 'Freelancer',
        key: `${organization.id}_freelancer`,
        organizationId: organization.id,
        description: 'Freelancer access: dashboard and own daily/monthly sheets',
      },
    });
  }

  for (const perm of FREELANCER_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
    const existing = await prisma.rolePermission.findFirst({
      where: { organizationId: organization.id, roleId: role.id, permissionId: permission.id },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: permission.id,
          effect: 'allow',
        },
      });
    }
  }

  const passwordHash = await PasswordService.hash(PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, role: 'freelancer' },
    create: {
      email: EMAIL,
      emailId: EMAIL,
      username: 'rabinrstack',
      fullName: 'Rabin R',
      passwordHash,
      role: 'freelancer',
      tenantId: organization.id,
    },
  });

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: organization.id } },
    update: {},
    create: { userId: user.id, tenantId: organization.id, role: 'member' },
  });

  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { userId: user.id, roleId: role.id, organizationId: organization.id },
  });
  if (!assignment) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: role.id,
        organizationId: organization.id,
        resourceType: 'tenant',
        resourceId: organization.id,
      },
    });
  }

  console.log(`✅ Freelancer user ready: ${EMAIL} (client code: zellavora-inc)`);
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
