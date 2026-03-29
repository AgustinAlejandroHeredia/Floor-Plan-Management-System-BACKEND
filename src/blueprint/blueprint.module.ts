import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { BlueprintController } from './blueprint.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Blueprint, BlueprintSchema } from './schemas/blueprint.schema';
import { FileStorageModule } from 'src/file-storage/file-storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blueprint.name, schema: BlueprintSchema }
    ]),
    FileStorageModule,
  ],
  controllers: [BlueprintController],
  providers: [BlueprintService],
})
export class BlueprintModule {}
