import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Dropping and recreating public schema...');
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE;');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
  await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO postgres;');
  await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO public;');
  console.log('✅ Database is now clean.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
