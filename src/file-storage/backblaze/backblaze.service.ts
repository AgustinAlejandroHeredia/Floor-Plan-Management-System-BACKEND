import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { FileStorageService, StoredFile } from '../file-storage.service';
import { ConfigService } from '@nestjs/config';
import * as FormData from 'form-data';

@Injectable()
export class BackblazeService implements FileStorageService {

  constructor(private readonly config: ConfigService) {}

  // 🔐 1. Autorización
  private async authorize() {
    try {
      const keyId = this.config.get<string>('BACKBLAZE_KEY_ID');
      const appKey = this.config.get<string>('BACKBLAZE_APPLICATION_KEY');

      if (!keyId || !appKey) {
        throw new InternalServerErrorException('Faltan credenciales de Backblaze');
      }

      const response = await axios.get(
        'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
        {
          auth: {
            username: keyId,
            password: appKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Backblaze auth error:', error.response?.data);
      throw new InternalServerErrorException('Error autorizando almacenamiento');
    }
  }

  // 📤 2. Subir archivo
  async uploadFile(file: Express.Multer.File): Promise<StoredFile> {
    try {
      const auth = await this.authorize();

      const uploadUrlRes = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_get_upload_url`,
        { bucketId: this.config.get('BACKBLAZE_BUCKET_ID') },
        {
          headers: {
            Authorization: auth.authorizationToken,
          },
        }
      );

      const uploadUrl = uploadUrlRes.data.uploadUrl;
      const uploadAuthToken = uploadUrlRes.data.authorizationToken;

      const response = await axios.post(uploadUrl, file.buffer, {
        headers: {
          Authorization: uploadAuthToken,
          'X-Bz-File-Name': encodeURIComponent(file.originalname),
          'Content-Type': file.mimetype,
          'X-Bz-Content-Sha1': 'do_not_verify',
        },
      });

      return {
        id: response.data.fileId,
        name: response.data.fileName,
      };
    } catch (error) {
      console.error('❌ Upload error:', error.response?.data);
      throw new InternalServerErrorException('Error subiendo archivo');
    }
  }

  // 🔍 3. Buscar por ID
  async getFileById(fileId: string): Promise<StoredFile> {
    try {
      const auth = await this.authorize();

      const response = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_get_file_info`,
        { fileId },
        {
          headers: {
            Authorization: auth.authorizationToken,
          },
        }
      );

      return {
        id: response.data.fileId,
        name: response.data.fileName,
      };
    } catch (error) {
      console.error('❌ Get file error:', error.response?.data);
      throw new InternalServerErrorException('Error obteniendo archivo');
    }
  }

  // 🔍 4. Buscar por nombre
  async getFileByName(fileName: string): Promise<StoredFile> {
    try {
      const auth = await this.authorize();

      const response = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_list_file_names`,
        {
          bucketId: this.config.get('BACKBLAZE_BUCKET_ID'),
          prefix: fileName,
          maxFileCount: 1,
        },
        {
          headers: {
            Authorization: auth.authorizationToken,
          },
        }
      );

      const file = response.data.files[0];

      return {
        id: file.fileId,
        name: file.fileName,
      };
    } catch (error) {
      console.error('❌ Get file by name error:', error.response?.data);
      throw new InternalServerErrorException('Error buscando archivo');
    }
  }

  // 🔗 5. Obtener URL de descarga
  async getDownloadUrl(fileId: string): Promise<string> {
    try {
      const auth = await this.authorize();

      return `${auth.downloadUrl}/file/${this.config.get(
        'BACKBLAZE_BUCKET_NAME'
      )}/${fileId}`;
    } catch (error) {
      console.error('❌ Download URL error:', error);
      throw new InternalServerErrorException('Error generando URL');
    }
  }

  // 🗑 6. Eliminar archivo
  async deleteFile(fileId: string): Promise<void> {
    try {
      const auth = await this.authorize();

      await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_delete_file_version`,
        {
          fileId,
          fileName: fileId, // necesario aunque es raro en B2
        },
        {
          headers: {
            Authorization: auth.authorizationToken,
          },
        }
      );
    } catch (error) {
      console.error('❌ Delete error:', error.response?.data);
      throw new InternalServerErrorException('Error eliminando archivo');
    }
  }
}