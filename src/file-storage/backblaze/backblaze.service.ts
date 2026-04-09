import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FileStorageService, StoredFile } from '../file-storage.service';

@Injectable()
export class BackblazeService implements FileStorageService {
  private authCache: any = null;

  constructor(private readonly config: ConfigService) {}

  // --------------------------
  // Autorización con cache
  // --------------------------
  private async authorize(): Promise<any> {
    if (this.authCache) return this.authCache;

    try {
      const keyId = this.config.get<string>('BACKBLAZE_KEY_ID');
      const appKey = this.config.get<string>('BACKBLAZE_APPLICATION_KEY');
      if (!keyId || !appKey) throw new Error('Faltan credenciales Backblaze');

      const res = await axios.get(
        'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
        { auth: { username: keyId, password: appKey } }
      );

      this.authCache = res.data;
      return this.authCache;
    } catch (err: any) {
      console.error('Backblaze auth error:', err.response?.data || err.message);
      throw new InternalServerErrorException('Error autorizando Backblaze');
    }
  }

  // --------------------------
  // Signed url
  // --------------------------
  async getSignedDownloadUrl(fileName: string): Promise<string> {
    try {
      const auth = await this.authorize();

      const validDuration = 180; // time of authorization (3 min)

      const res = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_get_download_authorization`,
        {
          bucketId: this.config.get('BACKBLAZE_BUCKET_ID'),
          fileNamePrefix: fileName,
          validDurationInSeconds: validDuration,
        },
        {
          headers: {
            Authorization: auth.authorizationToken,
          },
        }
      );

      const downloadAuthToken = res.data.authorizationToken;

      const url = `${auth.downloadUrl}/file/${this.config.get(
        'BACKBLAZE_BUCKET_NAME'
      )}/${encodeURIComponent(fileName)}?Authorization=${downloadAuthToken}`;

      return url;
    } catch (err: any) {
      console.error('Signed URL error:', err.response?.data || err.message);
      throw new InternalServerErrorException('Error generando URL firmada');
    }
  }

  // --------------------------
  // Subir archivo
  // --------------------------
  async uploadFile(file: Express.Multer.File): Promise<StoredFile> {
    try {
      const auth = await this.authorize();

      const uploadUrlRes = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_get_upload_url`,
        { bucketId: this.config.get('BACKBLAZE_BUCKET_ID') },
        { headers: { Authorization: auth.authorizationToken } }
      );

      const { uploadUrl, authorizationToken } = uploadUrlRes.data;

      const res = await axios.post(uploadUrl, file.buffer, {
        headers: {
          Authorization: authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(file.originalname),
          'Content-Type': file.mimetype,
          'X-Bz-Content-Sha1': 'do_not_verify',
        },
      });

      return {
        id: res.data.fileId,
        name: res.data.fileName,
      };
    } catch (err: any) {
      console.error('Upload error:', err.response?.data || err.message);
      throw new InternalServerErrorException('Error subiendo archivo');
    }
  }

  // --------------------------
  // Eliminar archivo
  // --------------------------
  async deleteFile(fileId: string): Promise<void> {
    try {
      const auth = await this.authorize();

      const fileInfoRes = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_get_file_info`,
        { fileId },
        { headers: { Authorization: auth.authorizationToken } }
      );

      const fileName = fileInfoRes.data.fileName;

      await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_delete_file_version`,
        { fileId, fileName },
        { headers: { Authorization: auth.authorizationToken } }
      );
    } catch (err: any) {
      console.error('Delete file error:', err.response?.data || err.message);
      throw new InternalServerErrorException('Error eliminando archivo');
    }
  }

}