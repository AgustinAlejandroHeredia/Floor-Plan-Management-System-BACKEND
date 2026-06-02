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
      return InternalServerErrorException
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

  findOne(id: number) {
    return `This action returns a #${id} activityLog`;
  }
}
