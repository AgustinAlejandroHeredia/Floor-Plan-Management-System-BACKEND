import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InferenceJobService } from './inference-job.service';
import { InferenceDetectionService } from './inference-detection.service';
import { InferenceJobController } from './inference-job.controller';
import { InferenceJobGateway } from './inference-job.gateway';
import { InferenceJob, InferenceJobSchema } from './schemas/inference-job.schema';
import { Blueprint, BlueprintSchema } from 'src/blueprint/schemas/blueprint.schema';
import { FileStorageModule } from 'src/file-storage/file-storage.module';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InferenceJob.name, schema: InferenceJobSchema },
      { name: Blueprint.name, schema: BlueprintSchema },
    ]),
    FileStorageModule,
    OrganizationMembershipModule,
    ActivityLogsModule,
  ],
  controllers: [InferenceJobController],
  providers: [InferenceJobService, InferenceDetectionService, InferenceJobGateway],
  exports: [InferenceJobService],
})
export class InferenceJobModule {}
