import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { DeleteProjectService } from './delete_project.service';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { AccessGuard } from 'src/auth/guards/access.guard';
import { OrganizationRole } from 'src/user/common/role.enum';
import { OrganizationRoles } from 'src/auth/decorators/organization-roles.decorator';

@ApiTags('DeleteProject')
@ApiBearerAuth('access-token')
@Controller('deleteproject')
export class DeleteProjectController {

    constructor(
        private readonly deleteProjectService: DeleteProjectService,
    ) {}

    @Delete(':projectId')
    @UseGuards(JwtAuthGuard, AccessGuard)
    @OrganizationRoles(OrganizationRole.ADMIN)
    @ApiOperation({ summary: 'Delete project (project, membership, blueprint and related files)' })
    @ApiResponse({ status: 201, description: 'Project deleted successfully' })
    delete(
        @Param('projectId') projectId: string
    ) {
        return this.deleteProjectService.deleteProject(projectId)
    }

}