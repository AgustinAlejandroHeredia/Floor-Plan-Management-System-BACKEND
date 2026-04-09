export interface StoredFile {
  id: string;
  name: string;
  url?: string;
  buffer?: Buffer;
  contentType?: string;
}

export abstract class FileStorageService {
  
  abstract uploadFile(file: Express.Multer.File): Promise<StoredFile>;

  abstract deleteFile(fileId: string): Promise<void>;

  abstract getSignedDownloadUrl(filename: string): Promise<string>;
}