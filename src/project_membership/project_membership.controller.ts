import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProjectMembershipService } from './project_membership.service';
import { CreateProjectMembershipDto } from './dto/create-project_membership.dto';
import { UpdateProjectMembershipDto } from './dto/update-project_membership.dto';

@Controller('project-membership')
export class ProjectMembershipController {
  constructor(private readonly projectMembershipService: ProjectMembershipService) {}

  @Post()
  create(@Body() createProjectMembershipDto: CreateProjectMembershipDto) {
    return this.projectMembershipService.create(createProjectMembershipDto);
  }

  @Get()
  findAll() {
    return this.projectMembershipService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectMembershipService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectMembershipDto: UpdateProjectMembershipDto) {
    return this.projectMembershipService.update(+id, updateProjectMembershipDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectMembershipService.remove(+id);
  }
}
