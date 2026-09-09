import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Blueprint, BlueprintSchema } from 'src/blueprint/schemas/blueprint.schema';
import { FileStorageModule } from 'src/file-storage/file-storage.module';
import { AuthModule } from 'src/auth/auth.module';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { AlignRunnerService } from './align-runner.service';
import { AutoAlignmentService } from './auto-alignment.service';
import { AutoAlignmentGateway } from './auto-alignment.gateway';
import { AutoAlignmentController } from './auto-alignment.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blueprint.name, schema: BlueprintSchema },
    ]),
    FileStorageModule,
    AuthModule,
    OrganizationMembershipModule,
  ],
  controllers: [AutoAlignmentController],
  providers: [AlignRunnerService, AutoAlignmentService, AutoAlignmentGateway],
  exports: [AutoAlignmentService],
})
export class AutoAlignmentModule {}
