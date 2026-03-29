import { Module } from '@nestjs/common';
import { ProjectMembershipService } from './project_membership.service';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { ProjectMembership, ProjectMembershipSchema } from './schemas/project_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectMembership.name, schema: ProjectMembershipSchema },
    ]),
  ],
  providers: [ProjectMembershipService],
  exports: [ProjectMembershipService],
})
export class ProjectMembershipModule {}
