import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { FileStorageService, StoredFile } from '../file-storage.service';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/tiff', 'image/bmp']);
const WEBP_QUALITY = 85;

@Injectable()
export class LocalFileStorageService implements FileStorageService {
  constructor(private readonly config: ConfigService) {}

  private getStorageDir(): string {
    return this.config.get<string>('LOCAL_STORAGE_PATH') || './uploads';
  }

  private getBaseUrl(): string {
    const port = this.config.get<string>('PORT') || '3000';
    return this.config.get<string>('APP_BASE_URL') || `http://localhost:${port}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<StoredFile> {
    try {
      const storageDir = this.getStorageDir();
      await fs.mkdir(storageDir, { recursive: true });

      let buffer = file.buffer;
      let contentType = file.mimetype;

      const webpEnabled = this.config.get<string>('WEBP_COMPRESSION_ENABLED') !== 'false';
      if (webpEnabled && IMAGE_TYPES.has(file.mimetype)) {
        buffer = await sharp(file.buffer)
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toBuffer();
        contentType = 'image/webp';
      }

      const filename = file.originalname;
      const filePath = path.join(storageDir, path.basename(filename));
      const metaPath = `${filePath}.meta.json`;

      await fs.writeFile(filePath, buffer);
      await fs.writeFile(metaPath, JSON.stringify({ contentType }));

      return { id: filename, name: filename, contentType };
    } catch (err: any) {
      console.error('Local upload error:', err.message);
      throw new InternalServerErrorException('Error saving file to local storage');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const storageDir = this.getStorageDir();
      const filePath = path.join(storageDir, path.basename(fileId));
      await Promise.allSettled([
        fs.unlink(filePath),
        fs.unlink(`${filePath}.meta.json`),
      ]);
    } catch (err: any) {
      console.error('Local delete error:', err.message);
    }
  }

  async getSignedDownloadUrl(filename: string): Promise<string> {
    const baseUrl = this.getBaseUrl();
    return `${baseUrl}/storage/${encodeURIComponent(filename)}`;
  }
}
