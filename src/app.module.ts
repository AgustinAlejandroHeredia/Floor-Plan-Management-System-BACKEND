import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from './jwt/jwt.module';
import { UserModule } from './user/user.module';
import { BlueprintModule } from './blueprint/blueprint.module';
import { OrganizationModule } from './organization/organization.module';
import { ProjectModule } from './project/project.module';
import { InvitationModule } from './invitation/invitation.module';
import { OrganizationMembershipModule } from './organization_membership/organization_membership.module';
import { ProjectMembershipModule } from './project_membership/project_membership.module';
import { ThumbnailModule } from './thumbnail/thumbnail.module';

// MONGOOSE
import { MongooseModule } from '@nestjs/mongoose';

import { DeleteOrganizationModule } from './use-cases/organization/delete-organization/delete_organization.module';
import { DeleteProjectModule } from './use-cases/project/delete-project/delete_project.module';
import { AiProcessingModule } from './ai-processing/ai-processing.module';
import { InferenceJobModule } from './inference-job/inference-job.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // mil segs
        limit: 100, // per ttl per ip (100 per 1 min) 
      }
    ]),

    JwtModule,

    UserModule,

    BlueprintModule,

    OrganizationModule,

    ProjectModule,

    InvitationModule,

    OrganizationMembershipModule,

    ProjectMembershipModule,

    ThumbnailModule,

    DeleteOrganizationModule,

    DeleteProjectModule,

    AiProcessingModule,

    InferenceJobModule,

    ActivityLogsModule,

    EmailModule,

    StorageModule,

  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService   
  ],
})
export class AppModule {}
