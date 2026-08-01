import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();

export type TxClient = Prisma.TransactionClient;

export class BaseRepository {
  protected getDb(tx?: TxClient) {
    return tx || prisma;
  }

  /**
   * Run a block inside a single Prisma transaction. The callback receives a
   * TxClient that every repository method in the call graph must thread
   * through (`getDb(tx)`), guaranteeing atomicity across repositories.
   */
  protected async withTransaction<T>(
    fn: (tx: TxClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number }
  ): Promise<T> {
    return prisma.$transaction(fn, {
      isolationLevel: options?.isolationLevel,
      timeout: options?.timeoutMs ?? 10000,
    });
  }
}
