import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';

import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

import { ProjectStatus } from 'src/common/status.enum';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ProjectRole } from 'src/common/role.enum';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // CREATE
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'projectName', 'record', 'address', 'scale', 'others',
        'references', 'background', 'owner', 'technicalDirection', 
        'creatorUserId', 'organizationId'
      ],
      properties: {
        projectName: { type: 'string', example: 'My Project' },
        record: { type: 'string', example: 'R123-2026-001' },
        address: { type: 'string', example: '123 Main St' },
        scale: { type: 'string', example: '1:50' },
        others: { type: 'string', example: 'Additional info' },
        references: { type: 'string', example: 'Ref documents' },
        background: { type: 'string', example: 'Project background' },
        owner: { type: 'string', example: 'John Doe' },
        technicalDirection: { type: 'string', example: 'Jane Smith' },
        organizationId: { type: 'string', example: '69cab08769c8cf094ae3c3c5' }
      },
    },
  })
  create(
    @Req() req,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.create(dto, req.user.internalId, dto.organizationId);
  }

  // GET ALL
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Projects list' })
  findAll() {
    return this.projectService.findAll();
  }

  // GET ONE
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get project by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Project found' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }

  // UPDATE
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  // DELETE USER FROM PROJECT
  @Delete('user/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete user from project' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  deleteUserFromProject(
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
  ){
    return this.projectService.deleteUserFromProject(userId, projectId)
  }

  // ADD USER TO PROJECT
  @Post('addUser/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Adds user to this project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'User added successfully' })
  addUser(
    @Req() req,
    @Param('projectId') projectId: string,
  ){
    return this.projectService.addUser(req.user.internalId, projectId)
  }

  // MY PROJECTs BY oganizationId
  @Get('me/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all the projects for this user by organizationId' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'Projects obtained successfully' })
  projectsByUserAndOrganization(
    @Req() req,
    @Param('organizationId') organizationId: string,
  ){
    return this.projectService.projectsByUserAndOrganization(organizationId, req.user.internalId)
  }

  @Get('organizationProjects/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all the projects for this organizationId' })
  @ApiParam({ name: 'organizationId', type: String })
  @ApiResponse({ status: 200, description: 'All projects obtained successfully' })
  getAllProjectsByOrganizationId(
    @Param('organizationId') organizationId: string,
  ){
    return this.projectService.getAllProjectsByOrganizationId(organizationId)
  }

  // GET MY PROJECT ROLE
  @Get('me/role/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my role with project id' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Role obtained successfully' })
  myProjectRole(
    @Req() req,
    @Param('projectId') projectId: string,
  ){
    return this.projectService.myProjectRole(req.user.internalId, projectId)
  }

  // UPDATE USER ROLE
  @Patch('membership/:projectId/:userId/:newProjectRole')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change the role of a user in a project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'newProjectRole', type: String })
  @ApiResponse({ status: 200, description: 'Project membership role updated successfully' })
  changeUserRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Param('newProjectRole') newProjectRole: ProjectRole,
  ) {
    if (!Object.values(ProjectRole).includes(newProjectRole as ProjectRole)) {
      throw new BadRequestException(
        `Invalid project role. Must be one of: ${Object.values(ProjectRole).join(', ')}`,
      );
    }

    return this.projectService.changeUserRoleByUserAndProject(userId, projectId, newProjectRole);
  }
}