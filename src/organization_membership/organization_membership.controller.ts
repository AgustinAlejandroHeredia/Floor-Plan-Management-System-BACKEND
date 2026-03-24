import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OrganizationMembershipService } from './organization_membership.service';
import { CreateOrganizationMembershipDto } from './dto/create-organization_membership.dto';
import { UpdateOrganizationMembershipDto } from './dto/update-organization_membership.dto';

@Controller('organization-membership')
export class OrganizationMembershipController {
  constructor(private readonly organizationMembershipService: OrganizationMembershipService) {}

  @Post()
  create(@Body() createOrganizationMembershipDto: CreateOrganizationMembershipDto) {
    return this.organizationMembershipService.create(createOrganizationMembershipDto);
  }

  @Get()
  findAll() {
    return this.organizationMembershipService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationMembershipService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrganizationMembershipDto: UpdateOrganizationMembershipDto) {
    return this.organizationMembershipService.update(+id, updateOrganizationMembershipDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationMembershipService.remove(+id);
  }
}
