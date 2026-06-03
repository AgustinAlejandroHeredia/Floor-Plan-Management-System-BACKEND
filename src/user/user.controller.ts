import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, Headers, Query, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// SWAGGER
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { AccessGuard } from 'src/auth/guards/access.guard';
import { UserRoles } from 'src/auth/decorators/user-roles.decorator';
import { UserRole } from 'src/user/common/role.enum';

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // Only self can patch user
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req,
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if(req.user.internalId !== id) throw new ForbiddenException("Permission denied")
    return this.userService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.NONE)
  @Get('userInfo')
  async getUserInfo(
    @Req() req,
  ){
    const { internalId, ...userWithoutInternalId } = req.user;
    return userWithoutInternalId;
  }

  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.NONE)
  @Get('myProfile')
  async getMyProfile(
    @Req() req,
  ){
    return await this.userService.findOne(req.user.internalId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('myOrganizations')
  async getUserOrganizations(@Req() req){
    return await this.userService.getUserOrganizations(req.user.internalId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('myProjects/:organizationId')
  async getUserProjectsByOrganization(
    @Req() req,
    @Param('organizationId') organizationId: string,
  ){
    return await this.userService.getUserProjectsByOrganization(req.user.internalId, organizationId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('allUsers/superadmin')
  async getAllUsersAsSuperadmin(
    @Req() req,
  ){
    if(req.user.globalRole !== UserRole.SUPERADMIN) throw new ForbiddenException("Access denied")
    return await this.userService.findAll()
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getUserProfile(
    @Req() req,
    @Query('userId') userId?: string,
  ){
    const targetUserId = userId ?? req.user.internalId
    return await this.userService.findOne(targetUserId)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('changeUserGlobalRole/:userId')
  async changeUserGlobalRole(
    @Req() req,
    @Param('userId') userId: string,
    @Body() newRole?: UserRole,
  ){
    if(req.user.globalRole !== UserRole.SUPERADMIN) throw new ForbiddenException("Access denied")
    return await this.userService.changeUserGlobalRole(userId, req.user.internalId, newRole)
  }

}
