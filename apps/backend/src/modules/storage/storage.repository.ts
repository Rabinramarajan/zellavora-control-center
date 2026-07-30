import fs from 'fs';
import path from 'path';

export class StorageRepository {
  async saveFile(fileName: string, base64Data: string): Promise<string> {
    const dir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/scratch/${fileName}`;
  }
}
