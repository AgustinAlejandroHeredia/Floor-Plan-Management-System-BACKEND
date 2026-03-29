import { Module } from '@nestjs/common';
import { ProjectMembershipService } from './project_membership.service';
import { ProjectMembershipController } from './project_membership.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { ProjectMembership, ProjectMembershipSchema } from './schemas/project_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectMembership.name, schema: ProjectMembershipSchema },
    ]),
  ],
  controllers: [ProjectMembershipController],
  providers: [ProjectMembershipService],
})
export class ProjectMembershipModule {}
