import { Prisma } from '@prisma/client';

/**
 * Users only appear in User Search / User Details once access has been approved: either an
 * approved NEW_USER request provisioned them, or an administrator granted them a role
 * (accounts that predate the request workflow). Self-registered and directly invited
 * accounts never receive a role on their own, so they stay hidden until approved.
 */
export const APPROVED_USER_WHERE: Prisma.UserWhereInput = {
  OR: [
    {
      userRequestsFor: {
        some: {
          type: 'NEW_USER',
          status: { in: ['PROVISIONING', 'COMPLETED'] },
          isDeleted: false,
        },
      },
    },
    { roleAssignments: { some: {} } },
  ],
};
