import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InferenceJobService } from './inference-job.service';
import { InferenceJobController } from './inference-job.controller';
import { InferenceJobGateway } from './inference-job.gateway';
import { InferenceJob, InferenceJobSchema } from './schemas/inference-job.schema';
import { Blueprint, BlueprintSchema } from 'src/blueprint/schemas/blueprint.schema';
import { FileStorageModule } from 'src/file-storage/file-storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InferenceJob.name, schema: InferenceJobSchema },
      { name: Blueprint.name, schema: BlueprintSchema },
    ]),
    FileStorageModule,
  ],
  controllers: [InferenceJobController],
  providers: [InferenceJobService, InferenceJobGateway],
  exports: [InferenceJobService],
})
export class InferenceJobModule {}
