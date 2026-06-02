import { Module } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-logs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema }
    ]),
  ],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
