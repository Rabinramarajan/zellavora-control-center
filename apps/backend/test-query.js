const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const org = await prisma.organization.findFirst({
      where: { clientCode: 'test' }
    });
  } catch (e) {
  } finally {
    await prisma.$disconnect();
  }
}

test();