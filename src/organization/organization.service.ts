import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// DTOs
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationActionPermissionsDto, UpdateOrganizationDto } from './dto/update-organization.dto';

// SCHEMA
import { Organization, OrganizationDocument } from './schemas/organization.schema';

// RELATIONS
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { OrganizationMembership } from 'src/organization_membership/schemas/organization_membership.schema';
import { OrganizationRole } from 'src/user/common/role.enum';
import { ProjectMembershipService } from 'src/project_membership/project_membership.service';
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';
import { OrganizationWithRoles } from './common/types';

@Injectable()
export class OrganizationService {

  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly projectMembershipService: ProjectMembershipService,
  ) {}

  // CREATE
  async create(
    createDto: CreateOrganizationDto,
  ): Promise<Organization> {
    try {
      // Crear la organización
      const created = new this.organizationModel(createDto);
      const savedOrganization = await created.save();

      // Crear automáticamente el OrganizationMembership del creador
      try {
        await this.organizationMembershipService.create({
          userId: createDto.adminId,
          organizationId: savedOrganization._id.toString(),
          organizationRole: OrganizationRole.ADMIN, // rol de administrador
        });
      } catch (membershipError) {
        await this.organizationModel.findByIdAndDelete(savedOrganization._id)
        console.log('ERROR creando OrganizationMembership:', membershipError);
        throw new InternalServerErrorException(
          'Error creating organization membership for the creator',
        );
      }

      return savedOrganization;

    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];

        throw new BadRequestException(
          `Organization with this ${field} already exists`
        );
      }
      throw error;
    }
  }

  // GET ALL
  async findAll(): Promise<Organization[]> {
    return this.organizationModel
      .find()
      .sort({ name: 1 })
      .lean()
  }

  // GET ALL MEMBERS OF THE ORGANIZATION AS ADMIN
  async getOrganizationMemberListAsAdmin(
    organizationId: string,
  ) {
    const members = await this.organizationMembershipService.findUsersByOrganization(
      organizationId,
    );

    return members
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
      .map(({ user, organizationRole }) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        organizationRole: organizationRole.charAt(0).toLocaleUpperCase() + organizationRole.slice(1)
      }));
  }

  // GET ONE
  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizationModel
      .findById(new Types.ObjectId(id))
      .lean();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async getOrganizationActionPermissions(id: string): Promise<({
    createPermission: OrganizationActionPermission,
    invitePermission: OrganizationActionPermission,
  })> {
    const organization = await this.organizationModel
      .findById(new Types.ObjectId(id))
      .lean()
    if(!organization){
      throw new Error("Organization not found")
    }
    return {
      createPermission: organization.createPermission,
      invitePermission: organization.invitePermission,
    }
  }

  // UPDATE
  async update(
    id: string,
    updateDto: UpdateOrganizationDto,
  ): Promise<OrganizationDocument> {
    const { name, contactEmail, contactPhone } = updateDto;

    // Verificar nombre único
    if (name) {
      const exists = await this.organizationModel.findOne({ 
        name, 
        _id: { $ne: id }  // Excluye la organización actual
      });
      if (exists) {
        throw new BadRequestException('Organization name already exists');
      }
    }

    // Verificar email único
    if (contactEmail) {
      const exists = await this.organizationModel.findOne({ 
        contactEmail, 
        _id: { $ne: id } 
      });
      if (exists) {
        throw new BadRequestException('Organization email already exists');
      }
    }

    // Verificar teléfono único
    if (contactPhone) {
      const exists = await this.organizationModel.findOne({ 
        contactPhone, 
        _id: { $ne: id } 
      });
      if (exists) {
        throw new BadRequestException('Organization phone already exists');
      }
    }

    // Actualizar con validadores de Mongoose
    try {
      const updated = await this.organizationModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        updateDto,
        { new: true, runValidators: true }, // runValidators asegura que se respeten los decorators de DTO
      );

      if (!updated) {
        throw new NotFoundException('Organization not found');
      }

      return updated;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Duplicate value for a unique field');
      }
      throw error;
    }
  }

  async updateOrganizationActionPermissions(
    id: string,
    updatePermissionsDto: UpdateOrganizationActionPermissionsDto,
  ): Promise<void> {
    try {
      const updated = await this.organizationModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        updatePermissionsDto,
        { new: true, runValidators: true }
      )
      if (!updated) {
        throw new NotFoundException('Organization not found');
      }
      return 
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Duplicate value for a unique field');
      }
      throw error;
    }
  }

  // DELETE
  async remove(id: string): Promise<void> {
    const result = await this.organizationModel.findByIdAndDelete(
      new Types.ObjectId(id),
    );

    if (!result) {
      throw new NotFoundException('Organization not found');
    }
  }

  // GET MY ORGANIZATIONS
  async getMyOrganizations(userId: string): Promise<Organization[]> {

    const memberships = await this.organizationMembershipService.findByUserId(userId)

    const organizationIds = memberships.map(m => m.organizationId)

    return this.organizationModel.find({
      _id: { $in: organizationIds },
    })
  }

  async getMyOrganizationsAndRoles(
    userId: string,
  ): Promise<OrganizationWithRoles[]> {

    const memberships = await this.organizationMembershipService.findByUserId(userId)

    const organizationIds = memberships.map((m) => m.organizationId)

    const organizations = await this.organizationModel.find({
      _id: { $in: organizationIds },
    })

    return memberships
      .map((membership) => {
        const organization = organizations.find(
          (org) =>
            org._id.toString() === membership.organizationId.toString(),
        );

        if (!organization) return null

        return {
          organization,
          role: membership.organizationRole,
        }
      })
      .filter(Boolean) as OrganizationWithRoles[]
  }


  // ADD USER TO ORGANIZATION
  async addUserToOrganization(
    organizationId: string,
    userId: string,
    organizationRole?: OrganizationRole,
  ): Promise<OrganizationMembership> {

    // ORG EXISTS?
    await this.findOne(organizationId);

    // DEFAILT : MEMBER
    let role = OrganizationRole.MEMBER
    if(organizationRole) {
      role = organizationRole
    }

    return this.organizationMembershipService.create({
      userId,
      organizationId,
      organizationRole: role,
    });
  }


  // REMOVE USER FROM ORGANIZATION
  async removeUserFromOrganization(
    organizationId: string,
    userId: string,
  ): Promise<void> {

    console.log("REMOVING USER ", userId, " FROM THE ORGANIZATION ", organizationId)

    // verificar que la org exista
    await this.organizationModel.findOne(new Types.ObjectId(organizationId));
    console.log("ORGANIZATION EXISTS")

    // expulsa al user de todos los proyectos de esa organizacion
    
    /* POR AHORA NO SE USA EL PROJECTMEMBERSHIP
    await this.projectMembershipService.deleteFromAllProjectsInOrganization(userId, organizationId)
    console.log("USER KICKED FROM PROJECTS")
    */

    // expulsa al user de la organizacion
    await this.organizationMembershipService.deleteByUserAndOrganization(
      userId,
      organizationId,
    )
    console.log("USER KICKED FROM ORGANIZATION")
  }


  // CHANGE USER ROLE
  async changeUserRole(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership> {

    // verificar que exista la membership
    const membership = await this.organizationMembershipService.findByUserIdAndOrganizationId(
      userId,
      organizationId,
    )

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    let currentRole
    if(membership.organizationRole === "member") {
      currentRole = "admin"
    } else {
      currentRole = "member"
    }

    return this.organizationMembershipService.updateRole(
      membership._id.toString(),
      { organizationRole: currentRole },
    );
  }

  // GET MY ORGANIZATION ROLE
  async myOrganizationRole(
    userId: string,
    organizationId: string,
  ): Promise<string> {

    const organizationRole = await this.organizationMembershipService.getUserRole(userId, organizationId)

    if (!organizationRole) {
      throw new NotFoundException('User is not a member of this organizationId');
    }

    return organizationRole;
  }

}