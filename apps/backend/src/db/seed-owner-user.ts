import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../services/auth/password.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding new owner user...\n');

  try {
    // Get the Zellavora Inc organization
    const organization = await prisma.organization.findUnique({
      where: { clientCode: 'zellavora-inc' },
    });

    if (!organization) {
      console.error('❌ Organization not found. Please run main seed first.');
      process.exit(1);
    }

    console.log(`📦 Organization found: ${organization.name}\n`);

    // Create/update the owner user
    console.log('👤 Creating owner user...');
    const password = 'Zellavora@6992'; // Meets policy: 12+ chars, uppercase, lowercase, digit, symbol
    console.log('  Hashing password...');
    let passwordHash: string;
    try {
      passwordHash = await PasswordService.hash(password);
      console.log('  ✅ Password hashed successfully');
    } catch (hashError) {
      console.error('  ❌ Password hashing failed:', hashError);
      throw hashError;
    }
    const ownerUser = await prisma.user.upsert({
      where: { email: 'noreply@zellavora.com' },
      update: {
        fullName: 'Rabin R',
        passwordHash,
      },
      create: {
        email: 'noreply@zellavora.com',
        emailId: 'noreply@zellavora.com',
        username: 'rabin',
        fullName: 'Rabin R',
        passwordHash,
        role: 'owner',
        tenantId: organization.id,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Owner user created: ${ownerUser.fullName}\n`);

    // Map user to tenant
    console.log('🔗 Mapping user to tenant...');
    await prisma.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: ownerUser.id,
          tenantId: organization.id,
        },
      },
      update: {},
      create: {
        userId: ownerUser.id,
        tenantId: organization.id,
        role: 'owner',
      },
    });
    console.log('✅ User-tenant mapping created\n');

    // Get the Owner role
    console.log('👑 Assigning Owner role...');
    const ownerRole = await prisma.role.findFirst({
      where: { name: 'Owner', organizationId: organization.id },
    });

    if (!ownerRole) {
      console.error('❌ Owner role not found. Please run main seed first.');
      process.exit(1);
    }

    // Assign the owner role to the user
    const existingAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: ownerUser.id,
        roleId: ownerRole.id,
        organizationId: organization.id,
      },
    });

    if (!existingAssignment) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: ownerUser.id,
          roleId: ownerRole.id,
          organizationId: organization.id,
          resourceType: 'tenant',
          resourceId: organization.id,
        },
      });
      console.log('✅ Owner role assigned\n');
    } else {
      console.log('⏭️  Owner role already assigned\n');
    }

    console.log('✨ Owner user created successfully!\n');
    console.log('📖 Login credentials:');
    console.log('   Email: noreply@zellavora.com');
    console.log('   Password: Zellavora@6992');
    console.log('   Client Code: zellavora-inc');
    console.log('   Role: Owner (Full Access)\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
