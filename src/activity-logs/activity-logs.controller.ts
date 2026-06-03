import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req, ForbiddenException } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@ApiTags('ActivityLogs')
@ApiBearerAuth('access-token')
@Controller('activity-logs')
export class ActivityLogsController {

  constructor(
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get('user')
  @UseGuards(JwtAuthGuard)
  getUserActivityLogs(
    @Req() req,
    @Query('userId') userId?: string,
  ){
    const targetUserId = userId ?? req.user.internalId
    if(req.user.internalId === targetUserId || req.user.globalRole === 'super_admin'){
      return this.activityLogsService.getUserActivityLogs(targetUserId)
    }
    throw new ForbiddenException ("Access denied")
  }
}
