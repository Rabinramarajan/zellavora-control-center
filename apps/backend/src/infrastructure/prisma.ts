import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();

export type TxClient = Prisma.TransactionClient;

export class BaseRepository {
  protected getDb(tx?: TxClient) {
    return tx || prisma;
  }
}
