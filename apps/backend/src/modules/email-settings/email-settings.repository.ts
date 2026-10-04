import type { EmailSetting } from '@prisma/client';
import { BaseRepository, type TxClient } from '../../infrastructure/prisma';

/** The single row's discriminator. See the EmailSetting model comment. */
export const SYSTEM_SCOPE = 'SYSTEM';

export class EmailSettingsRepository extends BaseRepository {
  public find(tx?: TxClient): Promise<EmailSetting | null> {
    return this.getDb(tx).emailSetting.findUnique({ where: { scope: SYSTEM_SCOPE } });
  }

  /**
   * Upsert on `scope` rather than `id`: callers configuring email for the
   * first time have no id, and the unique scope makes the write idempotent
   * under concurrent saves.
   */
  public upsert(
    data: Omit<
      EmailSetting,
      | 'id'
      | 'scope'
      | 'createdAt'
      | 'updatedAt'
      | 'lastTestedAt'
      | 'lastTestStatus'
      | 'lastTestError'
    >,
    tx?: TxClient
  ): Promise<EmailSetting> {
    return this.getDb(tx).emailSetting.upsert({
      where: { scope: SYSTEM_SCOPE },
      update: data,
      create: { ...data, scope: SYSTEM_SCOPE },
    });
  }

  public recordTestResult(
    result: { status: string; error: string | null },
    tx?: TxClient
  ): Promise<EmailSetting> {
    const data = {
      lastTestedAt: new Date(),
      lastTestStatus: result.status,
      lastTestError: result.error,
    };
    return this.getDb(tx).emailSetting.upsert({
      where: { scope: SYSTEM_SCOPE },
      update: data,
      create: { ...data, scope: SYSTEM_SCOPE },
    });
  }
}
