import { Module } from '@nestjs/common';
import { OrganizationMembershipService } from './organization_membership.service';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { OrganizationMembership, OrganizationMembershipSchema } from './schemas/organization_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationMembership.name, schema: OrganizationMembershipSchema },
    ]),
  ],
  providers: [OrganizationMembershipService],
  exports: [OrganizationMembershipService],
})
export class OrganizationMembershipModule {}
