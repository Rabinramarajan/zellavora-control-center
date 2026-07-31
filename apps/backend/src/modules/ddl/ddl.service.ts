import { DdlRepository } from './ddl.repository';

export class DdlService {
  private readonly repo = new DdlRepository();

  /**
   * Load one DDL list by type.
   * @param type e.g. 'country', 'language', 'gender'
   */
  async getByType(type: string) {
    const rows = await this.repo.findByType(type);
    return rows.map((row) => this.toPublic(row));
  }

  /**
   * Load all DDL lists grouped by type.
   * This is the common method used by forms to hydrate dropdowns in one call.
   */
  async getAll() {
    const rows = await this.repo.listActive();
    const grouped: Record<string, unknown[]> = {};

    for (const row of rows) {
      if (!grouped[row.type]) {
        grouped[row.type] = [];
      }
      grouped[row.type].push(this.toPublic(row));
    }

    return grouped;
  }

  /**
   * Load all DDL lists grouped by type, but only for the requested types.
   * @param types e.g. ['country', 'language', 'gender']
   */
  async getByTypes(types: string[]) {
    const grouped = await this.getAll();
    const result: Record<string, unknown[]> = {};
    for (const type of types) {
      result[type] = grouped[type] ?? [];
    }
    return result;
  }

  private toPublic(row: {
    type: string;
    key: string;
    value: string;
    label: string | null;
    phoneCode: string | null;
    extra: unknown;
    sortOrder: number;
    isActive: boolean;
  }) {
    return {
      type: row.type,
      key: row.key,
      value: row.value,
      label: row.label ?? row.value,
      phoneCode: row.phoneCode,
      extra: row.extra,
      sortOrder: row.sortOrder,
    };
  }
}
