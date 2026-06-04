import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';
import { OrganizationModule } from 'src/organization/organization.module';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { UserModule } from 'src/user/user.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';
import { User, UserSchema } from 'src/user/schemas/user.schema';
import { Organization, OrganizationSchema } from 'src/organization/schemas/organization.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invitation.name, schema: InvitationSchema },
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    OrganizationMembershipModule,
    OrganizationModule,
    UserModule,
    ActivityLogsModule,
  ],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
