import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { BackblazeService } from './backblaze/backblaze.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FileStorageService,
      useClass: BackblazeService,
    },
  ],
  exports: [FileStorageService],
})
export class FileStorageModule {}