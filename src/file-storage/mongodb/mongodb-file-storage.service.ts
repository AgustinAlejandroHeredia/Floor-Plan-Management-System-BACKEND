import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import sharp from 'sharp';
import { FileStorageService, StoredFile } from '../file-storage.service';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/tiff', 'image/bmp']);
const WEBP_QUALITY = 85;
const BUCKET_NAME = 'blueprints';

@Injectable()
export class MongoDbFileStorageService implements FileStorageService {
  private bucket: GridFSBucket | null = null;

  // connection injected as any to avoid decorator metadata issues with isolatedModules
  constructor(
    private readonly connection: any,
    private readonly config: ConfigService,
  ) {}

  private getBucket(): GridFSBucket {
    if (!this.bucket) {
      this.bucket = new GridFSBucket(this.connection.db, { bucketName: BUCKET_NAME });
    }
    return this.bucket;
  }

  private getBaseUrl(): string {
    const port = this.config.get<string>('PORT') || '3000';
    return this.config.get<string>('APP_BASE_URL') || `http://localhost:${port}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<StoredFile> {
    try {
      let buffer = file.buffer;
      let contentType = file.mimetype;

      if (IMAGE_TYPES.has(file.mimetype)) {
        buffer = await sharp(file.buffer)
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toBuffer();
        contentType = 'image/webp';
      }

      const bucket = this.getBucket();
      const uploadStream = bucket.openUploadStream(file.originalname, {
        metadata: { contentType },
      });

      return new Promise((resolve, reject) => {
        const readable = Readable.from(buffer);
        readable.pipe(uploadStream);
        uploadStream.on('finish', () => {
          resolve({
            id: uploadStream.id.toString(),
            name: file.originalname,
            contentType,
          });
        });
        uploadStream.on('error', reject);
      });
    } catch (err: any) {
      console.error('MongoDB upload error:', err.message);
      throw new InternalServerErrorException('Error saving file to MongoDB');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const bucket = this.getBucket();
      await bucket.delete(new ObjectId(fileId));
    } catch (err: any) {
      console.error('MongoDB delete error:', err.message);
    }
  }

  async getSignedDownloadUrl(filename: string): Promise<string> {
    const baseUrl = this.getBaseUrl();
    return `${baseUrl}/storage/${encodeURIComponent(filename)}`;
  }

  async streamFile(filename: string): Promise<{ stream: Readable; contentType: string }> {
    const bucket = this.getBucket();
    const files = await bucket.find({ filename }).toArray();
    if (!files.length) throw new Error(`File not found: ${filename}`);
    const file = files[0];
    const contentType = (file.metadata as any)?.contentType || 'application/octet-stream';
    const stream = bucket.openDownloadStreamByName(filename);
    return { stream, contentType };
  }
}
