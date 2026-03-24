import { Injectable } from '@nestjs/common';
import { CreateOrganizationMembershipDto } from './dto/create-organization_membership.dto';
import { UpdateOrganizationMembershipDto } from './dto/update-organization_membership.dto';

@Injectable()
export class OrganizationMembershipService {
  create(createOrganizationMembershipDto: CreateOrganizationMembershipDto) {
    return 'This action adds a new organizationMembership';
  }

  findAll() {
    return `This action returns all organizationMembership`;
  }

  findOne(id: number) {
    return `This action returns a #${id} organizationMembership`;
  }

  update(id: number, updateOrganizationMembershipDto: UpdateOrganizationMembershipDto) {
    return `This action updates a #${id} organizationMembership`;
  }

  remove(id: number) {
    return `This action removes a #${id} organizationMembership`;
  }
}
