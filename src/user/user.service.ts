import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthService } from 'src/auth/auth.service';

// MONGOOSE
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// SCHEMAS
import { User, UserDocument } from './schemas/user.schema';
import { Organization, OrganizationDocument } from 'src/organization/schemas/organization.schema';
import { OrganizationMembership, OrganizationMembershipDocument } from 'src/organization_membership/schemas/organization_membership.schema';
import { Project, ProjectDocument } from 'src/project/schemas/project.schema';
import { ProjectMembership, ProjectMembershipDocument } from 'src/project_membership/schemas/project_membership.schema';

@Injectable()
export class UserService {

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,

    @InjectModel(OrganizationMembership.name)
    private readonly orgMembershipModel: Model<OrganizationMembershipDocument>,

    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,

    @InjectModel(ProjectMembership.name)
    private readonly projectMembershipModel: Model<ProjectMembershipDocument>,

    private readonly authService: AuthService,
  ) {}

  // ======================
  // CREATE
  // ======================
  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  // ======================
  // FIND ALL
  // ======================
  async findAll(): Promise<User[]> {
    return this.userModel.find();
  }

  // ======================
  // FIND ONE
  // ======================
  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // ======================
  // UPDATE
  // ======================
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {

    const user = await this.userModel.findByIdAndUpdate(
      id,
      updateUserDto,
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // ======================
  // REMOVE
  // ======================
  async remove(id: string): Promise<void> {

    const result = await this.userModel.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {

    const userObjectId = new Types.ObjectId(userId);

    const organizationIds = await this.orgMembershipModel.distinct(
      'organizationId',
      { userId: userObjectId }
    );

    return this.organizationModel.find({
      _id: { $in: organizationIds },
    });
  }

  async getUserProjectsByOrganization(
    userId: string,
    organizationId: string,
  ): Promise<Project[]> {

    const userObjectId = new Types.ObjectId(userId);
    const organizationObjectId = new Types.ObjectId(organizationId);

    // 1. obtener proyectos donde participa el usuario
    const projectIds = await this.projectMembershipModel.distinct(
      'projectId',
      { userId: userObjectId }
    );

    // 2. filtrar por organización
    return this.projectModel.find({
      _id: { $in: projectIds },
      organizationId: organizationObjectId,
    });
  }

  // Used by jwt.strategy.ts
  async getOrCreateUserFromPayload(payload: any): Promise<UserDocument> {

    return this.userModel.findOneAndUpdate(
      { authProviderId: payload.sub },
      {
        $setOnInsert: {
          authProviderId: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );
  }

}