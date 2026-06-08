import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { InjectModel } from '@nestjs/mongoose';
import { ActivityLog, ActivityLogDocument } from './schemas/activity-logs.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class ActivityLogsService {

  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
  ) {}

  async create(userId: string, createActivityLogDto: CreateActivityLogDto) {
    try {

      const activitylog = new this.activityLogModel({
        ...createActivityLogDto,
        userId: new Types.ObjectId(userId)
      })

      const savedActivityLog = await activitylog.save()

      return savedActivityLog

    } catch (error) {
      console.log("WARNING : AN ERROR HAS OCCURRED REGISTERING AN EVENT. THE EVENT IS AN ", createActivityLogDto.action, " EXECUTED BY THE USER WITH ID ", userId)
    }
  }

  async getUserActivityLogs(userId: string) {
    return this.activityLogModel
      .find({
        userId: new Types.ObjectId(userId),
      })
      .sort({
        timestamp: -1,
      })
      .exec();
  }

  async deleteActivityLog(activityId: string) {
    return this.activityLogModel.findByIdAndDelete(new Types.ObjectId(activityId))
  }
}
