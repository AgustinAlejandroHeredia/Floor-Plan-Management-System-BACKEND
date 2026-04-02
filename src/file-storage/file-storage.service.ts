export interface StoredFile {
  id: string;
  name: string;
  url?: string;
  buffer?: Buffer;
  contentType?: string;
}

export abstract class FileStorageService {
  abstract uploadFile(file: Express.Multer.File): Promise<StoredFile>;

  abstract getFileById(fileId: string): Promise<StoredFile>;

  abstract getFileByName(fileName: string): Promise<StoredFile>;

  abstract getDownloadUrl(fileId: string): Promise<string>;

  abstract deleteFile(fileId: string): Promise<void>;

  abstract getDownloadUrlByName(fileName: string): string;

  abstract getSignedDownloadUrl(filename: string): Promise<string>;
}