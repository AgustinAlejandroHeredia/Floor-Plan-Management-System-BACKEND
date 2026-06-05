import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { ProjectMembershipModule } from 'src/project_membership/project_membership.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';
import { User, UserSchema } from 'src/user/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OrganizationMembershipModule,
    ProjectMembershipModule,
    ActivityLogsModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [
    OrganizationService,
    MongooseModule,
  ],
})
export class OrganizationModule {}
