import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageController } from './storage.controller';

@Module({
  imports: [ConfigModule, MongooseModule],
  controllers: [StorageController],
})
export class StorageModule {}
