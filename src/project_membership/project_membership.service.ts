import { Injectable, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';

// DTOs
import { CreateProjectMembershipDto } from './dto/create-project_membership.dto';
import { UpdateProjectMembershipDto } from './dto/update-project_membership.dto';

// SCHEMAs
import { ProjectMembership, ProjectMembershipDocument } from './schemas/project_membership.schema';


@Injectable()
export class ProjectMembershipService {

  constructor(
    @InjectModel(ProjectMembership.name)
    private readonly membershipModel: Model<ProjectMembershipDocument>,

    private readonly organizationMembershipService: OrganizationMembershipService,
  ) {}

  // CREATE
  async create(dto: CreateProjectMembershipDto & { organizationId: string }): Promise<ProjectMembership> {

      // Validar que el usuario pertenece a la organización
      const isMember = await this.organizationMembershipService.exists(
        dto.userId,
        dto.organizationId,
      )

      if (!isMember) {
        throw new BadRequestException(
          'User must be a member of the organization to join this project',
        )
      }

      try {
        // Crear membership
        return await this.membershipModel.create({
          ...dto,
          userId: new Types.ObjectId(dto.userId),
          projectId: new Types.ObjectId(dto.projectId),
        })
      } catch (error: any) {
        if (error.code === 11000) {
          throw new BadRequestException(
            'User is already a member of this project'
          );
        }
        throw error
      }
  }

  // GET BY PROJECT ID
  async findByProjectId(projectId: string): Promise<ProjectMembership[]> {
    return this.membershipModel
      .find({
        projectId: new Types.ObjectId(projectId),
      })
      .lean()
  }

  // GET BY USER ID
  async findByUserId(userId: string): Promise<ProjectMembership[]> {
    return this.membershipModel
      .find({
        userId: new Types.ObjectId(userId),
      })
      .lean()
  }

  // GET BY USER ID AND PROJECT ID
  async findByUserIdAndProjectId(userId: string, projectId: string): Promise<ProjectMembershipDocument> {
    const membership = await this.membershipModel.findOne({
      userId: new Types.ObjectId(userId),
      projectId: new Types.ObjectId(projectId),
    })

    if(!membership) {
      throw new NotFoundException('Project membership not found');
    }

    return membership
  }

  // UPDATE ROLE
  async updateRole(
    membershipId: string,
    updateDto: UpdateProjectMembershipDto,
  ): Promise<ProjectMembership> {

    console.log("UPDATE DTO DATA : ", updateDto)

    const updated = await this.membershipModel
      .findByIdAndUpdate(
        membershipId,
        { $set: { projectRole: updateDto.projectRole } },
        { new: true },
      )
      .lean()

    console.log("UPDATED DATA : ", updated)

    if (!updated) {
      throw new NotFoundException('Membership not found');
    }

    return updated;
  }

  // DELETE BY USER + PROJECT
  async deleteByUserAndProject(
    userId: string,
    projectId: string,
  ): Promise<void> {

    const result = await this.membershipModel.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      projectId: new Types.ObjectId(projectId),
    });

    if (!result) {
      throw new NotFoundException('Membership not found');
    }
  }

  // DELETE BY MEMBERSHIP ID
  async deleteById(membershipId: string): Promise<void> {

    const result = await this.membershipModel.findByIdAndDelete(membershipId);

    if (!result) {
      throw new NotFoundException('Membership not found');
    }
  }

  // DELETE USER FROM ALL PROJECTS (was quicked from the organization)
  async deleteFromAllProjectsInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const result = await this.membershipModel.deleteMany({
      userId: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
    });

    /*
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        'No project memberships found for this user in the specified organization',
      );
    }
    */
  }

  // EXISTS CHECK
  async exists(userId: string, projectId: string): Promise<boolean> {
    const result = await this.membershipModel.exists({
      userId: new Types.ObjectId(userId),
      projectId: new Types.ObjectId(projectId),
    });

    return !!result;
  }

  // GET USER ROLE
  async getUserRole(
    userId: string,
    projectId: string,
  ): Promise<string> {

    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        projectId: new Types.ObjectId(projectId),
      })
      .select('projectRole');

    if (!membership) {
      throw new NotFoundException('User is not a member of this project');
    }

    return membership.projectRole;
  }

  // use-case/delete_project
  async deleteAllMembershipsByProjectId(projectId: string): Promise<void> {
    if(!projectId){
      throw new BadRequestException('projectId is required');
    }

    const objectId = new Types.ObjectId(projectId)

    await this.membershipModel.deleteMany({
      projectId: objectId
    })
  }

  // use-case/delete_organization
  async deleteAllMembershipsByManyProjectIds(projectIds: string[]): Promise<void> {
    if(!projectIds || projectIds.length === 0){
      throw new BadRequestException('projectIds are required');
    }
    const objectIds = projectIds.map(id => new Types.ObjectId(id));
    await this.membershipModel.deleteMany({
      projectId: { $in: objectIds }
    })
  }

}