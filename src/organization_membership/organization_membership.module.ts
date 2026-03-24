import { Module } from '@nestjs/common';
import { OrganizationMembershipService } from './organization_membership.service';
import { OrganizationMembershipController } from './organization_membership.controller';

@Module({
  controllers: [OrganizationMembershipController],
  providers: [OrganizationMembershipService],
})
export class OrganizationMembershipModule {}
