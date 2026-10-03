import { Prisma } from '@prisma/client';

/**
 * Users only appear in User Search / User Details once an approved NEW_USER request has
 * provisioned them. System-role holders (seeded owner/admins) predate the workflow.
 * Self-registered and directly invited accounts stay hidden until approved.
 */
export const APPROVED_USER_WHERE: Prisma.UserWhereInput = {
  OR: [
    {
      userRequestsFor: {
        some: { type: 'NEW_USER', status: { in: ['PROVISIONING', 'COMPLETED'] }, isDeleted: false },
      },
    },
    { roleAssignments: { some: { role: { isSystem: true } } } },
  ],
};
