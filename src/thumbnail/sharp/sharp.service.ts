import { Injectable } from '@nestjs/common';
import sharp from "sharp";
import { ThumbnailService } from '../thumbnail.service';

@Injectable()
export class SharpService extends ThumbnailService {

  async createThumbnail(fileBuffer: Buffer): Promise<Buffer> {
    return await sharp(fileBuffer)
      .resize(200, 200, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

}