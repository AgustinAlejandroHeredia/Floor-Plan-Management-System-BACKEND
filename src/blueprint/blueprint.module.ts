import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { BlueprintController } from './blueprint.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Blueprint, BlueprintSchema } from './schemas/blueprint.schema';
import { FileStorageModule } from 'src/file-storage/file-storage.module';
import { ThumbnailModule } from 'src/thumbnail/thumbnail.module';
import { OrganizationModule } from 'src/organization/organization.module';
import { ProjectModule } from 'src/project/project.module';
import { InferenceJobModule } from 'src/inference-job/inference-job.module';
import { AuthModule } from 'src/auth/auth.module';
import { OrganizationMembership, OrganizationMembershipSchema } from 'src/organization_membership/schemas/organization_membership.schema';
import { ProjectMembership, ProjectMembershipSchema } from 'src/project_membership/schemas/project_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blueprint.name, schema: BlueprintSchema },
      // FOR THE AUTH MODULE
      { name: OrganizationMembership.name, schema: OrganizationMembershipSchema },
      { name: ProjectMembership.name, schema: ProjectMembershipSchema },
    ]),
    FileStorageModule,
    ThumbnailModule,
    OrganizationModule,
    ProjectModule,
    InferenceJobModule,
    AuthModule,
  ],
  controllers: [BlueprintController],
  providers: [
    BlueprintService,
  ],
  exports: [BlueprintService],
})
export class BlueprintModule {}
