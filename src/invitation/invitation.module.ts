import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';
import { OrganizationModule } from 'src/organization/organization.module';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invitation.name, schema: InvitationSchema },
    ]),
    OrganizationMembershipModule,
    OrganizationModule,
    UserModule,
  ],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
