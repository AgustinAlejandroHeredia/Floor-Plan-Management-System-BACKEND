import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectMembershipModule } from 'src/project_membership/project_membership.module';
import { Blueprint, BlueprintSchema } from 'src/blueprint/schemas/blueprint.schema';
import { Organization, OrganizationSchema } from 'src/organization/schemas/organization.schema';
import { OrganizationModule } from 'src/organization/organization.module';
import { OrganizationMembership } from 'src/organization_membership/schemas/organization_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Blueprint.name, schema: BlueprintSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    OrganizationMembership,
    ProjectMembershipModule,
    OrganizationModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
