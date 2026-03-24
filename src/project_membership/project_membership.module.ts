import { Module } from '@nestjs/common';
import { ProjectMembershipService } from './project_membership.service';
import { ProjectMembershipController } from './project_membership.controller';

@Module({
  controllers: [ProjectMembershipController],
  providers: [ProjectMembershipService],
})
export class ProjectMembershipModule {}
