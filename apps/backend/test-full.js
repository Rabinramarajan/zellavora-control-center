const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Test finding organization by clientCode
    const org = await prisma.organization.findFirst({
      where: { clientCode: 'test' }
    });
    console.log('Test 1 - findFirst by clientCode: OK (result:', !!org, ')');
    
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
    console.log('Test 2 - create organization: OK (id:', created.id, ')');
    
    // Test find by id
    const found = await prisma.organization.findUnique({
      where: { id: created.id }
    });
    console.log('Test 3 - findUnique by id: OK (name:', found.name, ')');
    
    // Test update
    const updated = await prisma.organization.update({
      where: { id: created.id },
      data: { legalName: 'Test Legal Name', industry: 'Technology' }
    });
    console.log('Test 4 - update with legalName/industry: OK (legalName:', updated.legalName, ')');
    
    // Test delete
    await prisma.organization.delete({
      where: { id: created.id }
    });
    console.log('Test 5 - delete: OK');
    
    console.log('\nAll tests passed!');
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Code:', e.code);
  } finally {
    await prisma.$disconnect();
  }
}

test();