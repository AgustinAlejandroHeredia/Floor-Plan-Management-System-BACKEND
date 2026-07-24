import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { GridFSBucket } from 'mongodb';
import type { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';

const BUCKET_NAME = 'blueprints';

@Controller('storage')
export class StorageController {
  private bucket: GridFSBucket | null = null;

  constructor(
    @Inject(getConnectionToken()) private readonly connection: any,
    private readonly config: ConfigService,
  ) {}

  private getBucket(): GridFSBucket {
    if (!this.bucket) {
      this.bucket = new GridFSBucket(this.connection.db, { bucketName: BUCKET_NAME });
    }
    return this.bucket;
  }

  @Get(':filename(*)')
  async serveFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const driver = this.config.get<string>('FILE_STORAGE_DRIVER') || 'backblaze';
    const safe = path.basename(decodeURIComponent(filename));

    if (driver === 'local') {
      const storageDir = this.config.get<string>('LOCAL_STORAGE_PATH') || './uploads';
      const filePath = path.join(storageDir, safe);
      const metaPath = `${filePath}.meta.json`;

      try {
        const [buffer, metaRaw] = await Promise.all([
          fs.readFile(filePath),
          fs.readFile(metaPath).catch(() => null),
        ]);
        const contentType = metaRaw
          ? (JSON.parse(metaRaw.toString()) as { contentType: string }).contentType
          : 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(buffer);
      } catch {
        throw new NotFoundException('File not found');
      }
      return;
    }

    if (driver === 'mongodb') {
      const bucket = this.getBucket();
      const files = await bucket.find({ filename: safe }).toArray();
      if (!files.length) throw new NotFoundException('File not found');

      const file = files[0];
      const contentType =
        (file.metadata as any)?.contentType || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      bucket.openDownloadStreamByName(safe).pipe(res);
      return;
    }

    throw new NotFoundException('Storage driver does not serve files directly');
  }
}
