// Fixtures for the end-to-end run: a second organization and users that exercise tenancy, deny rules,
// disabled roles, group-granted access and a member's notifications. Run by e2e/run.mjs.
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/services/auth/password.service';

const prisma = new PrismaClient();
const PASSWORD = 'E2e-Passw0rd!x';

async function main() {
  const hash = await PasswordService.hash(PASSWORD);
  const orgA = await prisma.organization.findUniqueOrThrow({ where: { clientCode: 'zellavora-inc' } });
  const orgB = await prisma.organization.create({
    data: { name: 'Beta Co', clientCode: 'beta-co', plan: 'enterprise', enforce2fa: false },
  });

  const allKeys = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permId = (key: string) => {
    const p = allKeys.find((k) => k.key === key);
    if (!p) throw new Error('permission missing: ' + key);
    return p.id;
  };

  const mkUser = async (email: string, role: string, org: { id: string }) => {
    const user = await prisma.user.create({
      data: {
        email,
        emailId: email,
        username: email.split('@')[0],
        fullName: email.split('@')[0],
        passwordHash: hash,
        role,
        tenantId: org.id,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });
    await prisma.userTenant.create({ data: { userId: user.id, tenantId: org.id, role: role as never } });
    return user;
  };
  const mkRole = async (name: string, org: { id: string }, keys: Array<[string, 'allow' | 'deny']>, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') => {
    const role = await prisma.role.create({
      data: { name, key: `${org.id}_${name.toLowerCase().replace(/\s+/g, '_')}`, organizationId: org.id, status },
    });
    for (const [key, effect] of keys) {
      await prisma.rolePermission.create({
        data: { organizationId: org.id, roleId: role.id, permissionId: permId(key), effect },
      });
    }
    return role;
  };
  const assign = (userId: string, roleId: string, org: { id: string }) =>
    prisma.userRoleAssignment.create({ data: { userId, roleId, organizationId: org.id } });

  // org B owner
  const ownerB = await mkRole('Owner', orgB, [['*:*', 'allow']]);
  const bob = await mkUser('bob@beta.test', 'owner', orgB);
  await assign(bob.id, ownerB.id, orgB);
  const bobPeer = await mkUser('peer@beta.test', 'member', orgB);

  // org A plain member: personal pages only
  const memberA = await mkRole('Plain Member', orgA, [['notifications:read', 'allow'], ['portfolio:read', 'allow']]);
  const carol = await mkUser('carol@acme.test', 'member', orgA);
  await assign(carol.id, memberA.id, orgA);

  // deny scenario: owner wildcard but an explicit deny on users:read
  const denyRole = await mkRole('Deny Users', orgB, [['users:read', 'deny']]);
  const dave = await mkUser('dave@beta.test', 'owner', orgB);
  await assign(dave.id, ownerB.id, orgB);
  await assign(dave.id, denyRole.id, orgB);

  // inactive-role scenario: the only role is switched off
  const offRole = await mkRole('Switched Off', orgB, [['*:*', 'allow']], 'INACTIVE');
  const erin = await mkUser('erin@beta.test', 'owner', orgB);
  await assign(erin.id, offRole.id, orgB);

  // group scenario: no direct role, access arrives through an active group
  const groupRole = await mkRole('Group Reader', orgB, [['users:read', 'allow']]);
  const group = await prisma.group.create({ data: { name: 'Beta Readers', slug: 'beta-readers', status: 'ACTIVE' } });
  await prisma.groupRole.create({ data: { groupId: group.id, roleId: groupRole.id } });
  const frank = await mkUser('frank@beta.test', 'member', orgB);
  await prisma.userGroup.create({ data: { userId: frank.id, groupId: group.id } });

  // notifications for carol, three for someone else, spread over time
  const base = Date.now();
  for (let i = 0; i < 30; i++) {
    await prisma.notification.create({
      data: {
        organizationId: orgA.id,
        recipientId: carol.id,
        title: `carol ${i}`,
        body: `n${i}`,
        channels: ['in_app'],
        status: 'pending',
        createdAt: new Date(base - (30 - i) * 60_000),
      },
    });
  }
  await prisma.notification.create({
    data: { organizationId: orgB.id, recipientId: bob.id, title: 'bob private', body: 'secret', channels: ['in_app'], status: 'pending' },
  });

  const ids = { orgA: orgA.id, orgB: orgB.id, bob: bob.id, carol: carol.id, peer: bobPeer.id };
  console.log(JSON.stringify(ids));
}

main().finally(() => prisma.$disconnect());
