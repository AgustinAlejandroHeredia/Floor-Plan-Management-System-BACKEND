import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { FileStorageService } from './file-storage.service';
import { BackblazeService } from './backblaze/backblaze.service';
import { LocalFileStorageService } from './local/local-file-storage.service';
import { MongoDbFileStorageService } from './mongodb/mongodb-file-storage.service';

@Module({
  imports: [ConfigModule, MongooseModule],
  providers: [
    {
      provide: FileStorageService,
      useFactory: (config: ConfigService, connection: Connection): FileStorageService => {
        const driver = config.get<string>('FILE_STORAGE_DRIVER') || 'backblaze';
        switch (driver) {
          case 'local':
            return new LocalFileStorageService(config);
          case 'mongodb':
            return new MongoDbFileStorageService(connection, config);
          case 'backblaze':
          default:
            return new BackblazeService(config);
        }
      },
      inject: [ConfigService, getConnectionToken()],
    },
  ],
  exports: [FileStorageService],
})
export class FileStorageModule {}
