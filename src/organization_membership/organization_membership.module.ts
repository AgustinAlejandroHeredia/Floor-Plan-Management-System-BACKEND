import { Module } from '@nestjs/common';
import { OrganizationMembershipService } from './organization_membership.service';
import { OrganizationMembershipController } from './organization_membership.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { OrganizationMembership, OrganizationMembershipSchema } from './schemas/organization_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationMembership.name, schema: OrganizationMembershipSchema },
    ]),
  ],
  controllers: [OrganizationMembershipController],
  providers: [OrganizationMembershipService],
})
export class OrganizationMembershipModule {}
