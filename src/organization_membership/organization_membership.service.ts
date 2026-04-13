import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// DTOs
import { CreateOrganizationMembershipDto } from './dto/create-organization_membership.dto';
import { UpdateOrganizationMembershipDto } from './dto/update-organization_membership.dto';

// SCHEMAs
import { OrganizationMembership, OrganizationMembershipDocument } from './schemas/organization_membership.schema';
import { UserDocument } from 'src/user/schemas/user.schema';

@Injectable()
export class OrganizationMembershipService {

  constructor(
    @InjectModel(OrganizationMembership.name)
    private readonly membershipModel: Model<OrganizationMembershipDocument>,
  ) {}

  // CREATE
  async create(createDto: CreateOrganizationMembershipDto): Promise<OrganizationMembershipDocument> {
    try {
      const created = new this.membershipModel({
        ...createDto,
        userId: new Types.ObjectId(createDto.userId),
        organizationId: new Types.ObjectId(createDto.organizationId),
      });

      return await created.save();
    } catch (error: any) {
      // Error de índice único (duplicado)
      if (error.code === 11000) {
        throw new BadRequestException('User is already a member of this organization');
      }
      throw error;
    }
  }

  // GET BY ORGANIZATION ID
  async findByOrganizationId(organizationId: string): Promise<OrganizationMembershipDocument[]> {
    return this.membershipModel.find({
      organizationId: new Types.ObjectId(organizationId),
    });
  }

  // GET BY USER ID
  async findByUserId(userId: string): Promise<OrganizationMembershipDocument[]> {
    return this.membershipModel.find({
      userId: new Types.ObjectId(userId),
    });
  }

  // GET BY USER ID AND ORGANIZATION ID
  async findByUserIdAndOrganizationId(userId: string, organizationId: string): Promise<OrganizationMembershipDocument> {
    const membership = await this.membershipModel.findOne({
      userId: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId), 
    })

    if(!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    return membership
  }

  // UPDATE ROLE (solo role)
  async updateRole(
    membershipId: string,
    updateDto: UpdateOrganizationMembershipDto,
  ): Promise<OrganizationMembershipDocument> {

    const updated = await this.membershipModel.findByIdAndUpdate(
      membershipId,
      { $set: { organizationRole: updateDto.organizationRole } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Membership not found');
    }

    return updated;
  }

  // DELETE BY USER + ORGANIZATION
  async deleteByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {

    const result = await this.membershipModel.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
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

  // EXISTS CHECK
  async exists(userId: string, organizationId: string): Promise<boolean> {
    const result = await this.membershipModel.exists({
      userId: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
    });

    return !!result;
  }

  // GET USER ROLE OF MEMBERSHIP
  async getUserRole(
    userId: string,
    organizationId: string,
  ): Promise<string> {

    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(organizationId),
      })
      .select('organizationRole')
      .lean()

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    return membership.organizationRole;
  }

  async findUsersByOrganization(
    organizationId: string,
  ): Promise<{ user: UserDocument; organizationRole: string }[]> {

    const memberships = await this.membershipModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
      })
      .populate<{ userId: UserDocument }>({
        path: 'userId',
        select: '_id name email picture',
      })

    return memberships.map((membership) => ({
      user: membership.userId,
      organizationRole: membership.organizationRole,
    }));
  }

  // use-case/delete_organization
  async deleteAllMembershipsByOrganizationId(organizationId: string): Promise<void> {
    if(!organizationId){
      throw new BadRequestException('organizationId is required')
    }

    const objectId = new Types.ObjectId(organizationId)

    await this.membershipModel.deleteMany({
      organizationId: objectId
    })
  }

}