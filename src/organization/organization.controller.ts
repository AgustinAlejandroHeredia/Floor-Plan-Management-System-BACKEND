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
  Query,
} from '@nestjs/common';

import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationActionPermissionsDto, UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OrganizationRole, UserRole } from 'src/user/common/role.enum';
import { UserRoles } from 'src/auth/decorators/user-roles.decorator';
import { OrganizationRoles } from 'src/auth/decorators/organization-roles.decorator';
import { AccessGuard } from 'src/auth/guards/access.guard';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
export class OrganizationController {

  constructor(
    private readonly organizationService: OrganizationService,
  ) {}

  // CREATE
  @Post()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
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
    @Body() dto: CreateOrganizationDto,
    @Req() req,
  ) {
    return this.organizationService.create(dto, req.user.internalId)
  }

  // GET ALL AS SUPERADMIN
  @Get('/allOrganizations/superadmin')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all organizations - superadmin users only' })
  @ApiResponse({ status: 200, description: 'Organizations list' })
  findAll() {
    return this.organizationService.findAll();
  }

  // GET ALL ORGANIZATION MEMBERS AS ORGANIZATION ADMIN
  @Get('/allMembers/admin/:organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Get all members for the organization - organization admin users only' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'Organization member list obtained successfully' })
  getOrganizationMemberListAsAdmin(
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.getOrganizationMemberListAsAdmin(organizationId)
  }

  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @Get('superadmin/organizations-with-members')
  getAllOrganizationsWithMembers(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.organizationService.getAllOrganizationsWithMembers(
      Number(page),
      Number(limit),
    );
  }

  // GET ONE
  @Get(':organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(
    OrganizationRole.ADMIN,
    OrganizationRole.MEMBER,
  )
  @ApiOperation({ summary: 'Get organization by id - all organization members' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization found' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('organizationId') organizationId: string) {
    return this.organizationService.findOne(organizationId);
  }

  // GET ORGANIZATION ACTION PERMISSIONS
  @Get('/actionPermissions/:organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(
    OrganizationRole.ADMIN,
    OrganizationRole.MEMBER,
  )
  @ApiOperation({ summary: 'Get organization action permissions - all organization members' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization action permissions obtained successfully' })
  getOrganizationActionPermissions(
    @Param('organizationId') organizationId: string
  ){
    return this.organizationService.getOrganizationActionPermissions(organizationId)
  }

  // UPDATE
  @Patch(':organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update organization - only superadmin users' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req,
  ) {
    return this.organizationService.update(organizationId, dto, req.user.internalId);
  }

  // UPDATE ORGANIZATION ACTION PERMISSIONS
  @Patch('actionPermissions/admin/:organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Update organization action permissions as organization admin' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'Organization action permissions updated successfully' })
  updateOrganizationActionPermissions(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationActionPermissionsDto,
    @Req() req,
  ){
    if(!dto.createPermission && !dto.invitePermission){
      return
    }
    return this.organizationService.updateOrganizationActionPermissions(organizationId, dto, req.user.internalId)
  }

  // ADD USER TO ORGANIZATION
  @Post('addUser/:organizationId/:userId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Adds user to this organization - only superadmin users' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        organizationRole: {
          type: 'string',
          enum: ['admin', 'member'],
          example: 'member',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User added successfully' })
  addUser(
    @Req() req,
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Body('organizationRole') organizationRole?: OrganizationRole,
  ){
    return this.organizationService.addUserToOrganization(organizationId, userId, req.user.internalId, organizationRole)
  }

  // GET MY ORGANIZATIONS
  @Get('me/organizations')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all my organizations - all web page users' })
  @ApiResponse({ status: 200, description: 'All my organizations obtained successfully' })
  getMyOrganizations(
    @Req() req,
  ){
    return this.organizationService.getMyOrganizations(req.user.internalId)
  }

  // GET MY ORGANIZATIONS WITH ROLES
  @Get('me/organizationsAndRoles')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all my organizations and it roles - all web page users' })
  @ApiResponse({ status: 200, description: 'All my organizations obtained successfully' })
  getMyOrganizationWithRoles(
    @Req() req,
  ){
    return this.organizationService.getMyOrganizationsAndRoles(req.user.internalId)
  }

  // GET MY ORGANIZATION ROLE
  @Get('me/role/:organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(
    OrganizationRole.ADMIN,
    OrganizationRole.MEMBER,
  )
  @ApiOperation({ summary: 'Get my role with organization id - only organization member users' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'Role obtained successfully' })
  myProjectRole(
    @Req() req,
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.myOrganizationRole(req.user.internalId, organizationId)
  }

  // UPDATE USER ROLE
  @Patch('/membership/:organizationId/:userId/role')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Change the role of a user in a organization - only organization admin users' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, description: 'Organization membership role updated successfully' })
  changeUserRole(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Req() req,
  ) {
    return this.organizationService.changeUserRole(userId, organizationId, req.user.internalId);
  }

  // REMOVE USER FROM ORGANIZATION
  @Delete('/user/:userId/:organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Delete user from organization - only organization admin users' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'User deleted from organization successfully' })
  deleteUserFromOrganization(
    @Param('userId') userId: string,
    @Param('organizationId') organizationId: string,
    @Req() req,
  ){
    return this.organizationService.removeUserFromOrganization(organizationId, userId, req.user.internalId)
  }

  // REMOVE SELF FROM ORGANIZATION
  @Delete('/me/:organizationId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @OrganizationRoles(
    OrganizationRole.ADMIN,
    OrganizationRole.MEMBER,
  )
  @ApiOperation({ summary: 'Delete self from organization - only organization members' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'User deleted from organization successfully' })
  leaveOrganization(
    @Req() req,
    @Param('organizationId') organizationId: string,
  ){
    return this.organizationService.removeUserFromOrganization(organizationId, req.user.internalId)
  }

}