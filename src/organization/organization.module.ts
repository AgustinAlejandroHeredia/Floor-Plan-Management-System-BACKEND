import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { ProjectMembershipModule } from 'src/project_membership/project_membership.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    OrganizationMembershipModule,
    ProjectMembershipModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
