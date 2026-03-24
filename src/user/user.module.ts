import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from 'src/auth/auth.module';

// MONGOOSE
import { MongooseModule } from '@nestjs/mongoose';

// SCHEMA
import { User, UserSchema } from 'src/user/schemas/user.schema';
import { Organization, OrganizationSchema } from 'src/organization/schemas/organization.schema';
import { OrganizationMembership, OrganizationMembershipSchema } from 'src/organization_membership/schemas/organization_membership.schema';
import { Project, ProjectSchema } from 'src/project/schemas/project.schema';
import { ProjectMembership, ProjectMembershipSchema } from 'src/project_membership/schemas/project_membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrganizationMembership.name, schema: OrganizationMembershipSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectMembership.name, schema: ProjectMembershipSchema },
    ]),
    AuthModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
