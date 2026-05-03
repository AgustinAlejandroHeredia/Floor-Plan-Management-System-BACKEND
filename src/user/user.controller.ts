import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, Headers, Query } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @Get('allUsers/superadmin')
  async getAllUsersAsSuperadmin(){
    return await this.userService.findAll()
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getUserProfile(
    @Req() req,
    @Query('userId') userId?: string,
  ){
    const targetUserId = userId ?? req.user.internalId
    return await this.userService.getUserProfile()
  }

}
