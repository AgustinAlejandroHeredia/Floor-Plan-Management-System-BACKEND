import { Module } from '@nestjs/common';
import { ProjectMembershipService } from './project_membership.service';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { ProjectMembership, ProjectMembershipSchema } from './schemas/project_membership.schema';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { ProjectModule } from 'src/project/project.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectMembership.name, schema: ProjectMembershipSchema },
    ]),
    OrganizationMembershipModule,
    ProjectModule,
  ],
  providers: [ProjectMembershipService],
  exports: [ProjectMembershipService],
})
export class ProjectMembershipModule {}
