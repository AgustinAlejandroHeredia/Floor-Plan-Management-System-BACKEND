import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { DeleteOrganizationService } from "./delete_organization.service";

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { AccessGuard } from 'src/auth/guards/access.guard';
import { UserRoles } from 'src/auth/decorators/user-roles.decorator';
import { UserRole } from 'src/common/role.enum';


@ApiTags('DeleteOrganization')
@ApiBearerAuth('access-token')
@Controller('deleteorganization')
export class DeleteOrganizationController {

    constructor(
        private readonly deleteOrganizationService: DeleteOrganizationService,
    ) {}

    @Delete(':organizationId')
    @UseGuards(JwtAuthGuard, AccessGuard)
    @UserRoles(UserRole.SUPERADMIN)
    @ApiOperation({ summary: 'Delete organization (org, projects, memberships, blueprints and related files)' })
    @ApiResponse({ status: 201, description: 'Organization deleted successfully' })
    delete(
        @Param('organizationId') organizationId: string
    ) {
        return this.deleteOrganizationService.deleteOrganization(organizationId)
    }

}