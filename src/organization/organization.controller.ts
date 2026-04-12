import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  Req,
  BadRequestException,
} from '@nestjs/common';

import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OrganizationRole } from 'src/common/role.enum';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
export class OrganizationController {

  constructor(
    private readonly organizationService: OrganizationService,
  ) {}

  // CREATE
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'address', 'contactEmail', 'contactPhone', 'record'],
      properties: {
        name: { type: 'string', example: 'Acme Corp' },
        address: { type: 'string', example: '123 Main St, City, Country' },
        contactEmail: { type: 'string', example: 'contact@acme.com' },
        contactPhone: { type: 'string', example: '+541112345678' },
        record: { type: 'string', example: 'A1B2-2026-001' },
      },
    },
  })
  create(
    @Req() req,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationService.create(dto, req.user.internalId);
  }

  // GET ALL
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({ status: 200, description: 'Organizations list' })
  findAll() {
    return this.organizationService.findAll();
  }

  // GET ALL ORGANIZATION MEMBERS 
  @Get('/allMembers/admin/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all members for the organization as admin' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'Organization member list obtained successfully' })
  getOrganizationMemberListAsAdmin(
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.getOrganizationMemberListAsAdmin(organizationId)
  }

  // GET ONE
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get organization by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization found' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  // UPDATE
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }

  // DELETE
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization deleted successfully' })
  remove(@Param('id') id: string) {
    //return this.organizationService.remove(id);
  }

  // ADD USER TO ORGANIZATION
  @Post('addUser/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Adds user to this organization' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'User added successfully' })
  addUser(
    @Param('userId') userId: string,
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.addUserToOrganization(organizationId, userId)
  }

  // GET MY ORGANIZATIONS
  @Get('me/organizations')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all my organizations' })
  @ApiResponse({ status: 200, description: 'All my organizations obtained successfully' })
  getMyOrganizations(
    @Req() req,
  ){
    return this.organizationService.getMyOrganizations(req.user.internalId)
  }

  // GET MY ORGANIZATION ROLE
  @Get('me/role/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my role with organization id' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'Role obtained successfully' })
  myProjectRole(
    @Req() req,
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.myOrganizationRole(req.user.internalId, organizationId)
  }

  // UPDATE USER ROLE
  @Patch('membership/:organizationId/:userId/role')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change the role of a user in a organization' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'newOrganizationRole', type: String })
  @ApiResponse({ status: 200, description: 'Organization membership role updated successfully' })
  changeUserRole(
    @Param('organizationId') projectId: string,
    @Param('userId') userId: string,
    @Body('newOrganizationRole') newOrganizationRole: OrganizationRole,
  ) {
    if (!Object.values(OrganizationRole).includes(newOrganizationRole as OrganizationRole)) {
      throw new BadRequestException(
        `Invalid project role. Must be one of: ${Object.values(OrganizationRole).join(', ')}`,
      );
    }

    return this.organizationService.changeUserRole(userId, projectId, newOrganizationRole);
  }

  // REMOVE USER FROM ORGANIZATION
  @Delete('user/:userId/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete user from organization' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'User deleted from organization successfully' })
  deleteUserFromOrganization(
    @Param('userId') userId: string,
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.removeUserFromOrganization(organizationId, userId)
  }

}