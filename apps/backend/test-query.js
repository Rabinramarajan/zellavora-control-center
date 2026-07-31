const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const org = await prisma.organization.findFirst({
      where: { clientCode: 'test' }
    });
    console.log('Query succeeded:', !!org);
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Code:', e.code);
  } finally {
    await prisma.$disconnect();
  }
}

test();