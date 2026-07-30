import { StorageRepository } from './storage.repository';

export class StorageService {
  private readonly repo = new StorageRepository();

  async uploadFile(fileName: string, base64Data: string) {
    const extension = fileName.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const url = await this.repo.saveFile(uniqueName, base64Data);
    return { url, name: uniqueName };
  }
}
