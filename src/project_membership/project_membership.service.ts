import { Injectable } from '@nestjs/common';
import { CreateProjectMembershipDto } from './dto/create-project_membership.dto';
import { UpdateProjectMembershipDto } from './dto/update-project_membership.dto';

@Injectable()
export class ProjectMembershipService {
  create(createProjectMembershipDto: CreateProjectMembershipDto) {
    return 'This action adds a new projectMembership';
  }

  findAll() {
    return `This action returns all projectMembership`;
  }

  findOne(id: number) {
    return `This action returns a #${id} projectMembership`;
  }

  update(id: number, updateProjectMembershipDto: UpdateProjectMembershipDto) {
    return `This action updates a #${id} projectMembership`;
  }

  remove(id: number) {
    return `This action removes a #${id} projectMembership`;
  }
}
