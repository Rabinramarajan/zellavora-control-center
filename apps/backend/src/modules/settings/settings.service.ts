import { SettingsRepository } from './settings.repository';
import { AppError } from '../../middleware/error';

export class SettingsService {
  private readonly repo = new SettingsRepository();

  async getSetting(orgId: string, key: string) {
    const config = await this.repo.findByKey(orgId, key);
    if (!config) {
      throw new AppError('Setting configuration not found', 404, 'SETTING_NOT_FOUND');
    }
    return config;
  }

  async getSettingsForOrg(orgId: string) {
    return this.repo.listByOrganization(orgId);
  }

  async saveSetting(orgId: string, key: string, value: string, category?: string | null) {
    return this.repo.set(orgId, key, value, category);
  }

  async deleteSetting(orgId: string, key: string) {
    await this.getSetting(orgId, key);
    return this.repo.delete(orgId, key);
  }
}
