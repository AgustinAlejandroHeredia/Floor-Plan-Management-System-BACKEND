import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, Headers } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// SWAGGER
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@ApiTags('User')
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

  @UseGuards(JwtAuthGuard)
  @Get('userInfo')
  async getUserInfo(@Req() req){
    return req.user
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

}
