const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Test finding organization by clientCode
    const org = await prisma.organization.findFirst({
      where: { clientCode: 'test' }
    });
    
    // Test create
    const created = await prisma.organization.create({
      data: {
        name: 'Test Org',
        clientCode: 'test123',
        plan: 'free',
        status: 'active',
        enforce2fa: false,
      }
    });
    
    // Test find by id
    const found = await prisma.organization.findUnique({
      where: { id: created.id }
    });
    
    // Test update
    const updated = await prisma.organization.update({
      where: { id: created.id },
      data: { legalName: 'Test Legal Name', industry: 'Technology' }
    });
    
    // Test delete
    await prisma.organization.delete({
      where: { id: created.id }
    });
    
  } catch (e) {
  } finally {
    await prisma.$disconnect();
  }
}

test();