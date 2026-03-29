import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from './jwt/jwt.module';
import { UserModule } from './user/user.module';

// MONGOOSE
import { MongooseModule } from '@nestjs/mongoose';
import { BlueprintModule } from './blueprint/blueprint.module';
import { OrganizationModule } from './organization/organization.module';
import { ProjectModule } from './project/project.module';
import { InvitationModule } from './invitation/invitation.module';
import { OrganizationMembershipModule } from './organization_membership/organization_membership.module';
import { ProjectMembershipModule } from './project_membership/project_membership.module';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),

    JwtModule,

    UserModule,

    BlueprintModule,

    OrganizationModule,

    ProjectModule,

    InvitationModule,

    OrganizationMembershipModule,

    ProjectMembershipModule,
    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
