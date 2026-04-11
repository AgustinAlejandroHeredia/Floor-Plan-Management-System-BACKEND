import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// DTOs
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

// SCHEMA
import { Organization, OrganizationDocument } from './schemas/organization.schema';
import { User } from 'src/user/schemas/user.schema';

// RELATIONS
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { OrganizationMembership } from 'src/organization_membership/schemas/organization_membership.schema';
import { OrganizationRole } from 'src/common/role.enum';
import { ProjectMembershipService } from 'src/project_membership/project_membership.service';

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
    creatorUserId: string,
  ): Promise<Organization> {
    try {
      // Crear la organización
      const created = new this.organizationModel(createDto);
      const savedOrganization = await created.save();

      // Crear automáticamente el OrganizationMembership del creador
      try {
        await this.organizationMembershipService.create({
          userId: creatorUserId,
          organizationId: savedOrganization._id.toString(),
          organizationRole: OrganizationRole.ADMIN, // rol de administrador
        });
      } catch (membershipError) {
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
    return this.organizationModel.find();
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
    const organization = await this.organizationModel.findById(
      new Types.ObjectId(id),
    );

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
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
    } catch (error) {
      // Capturar errores de índice único que puedan saltar por alguna razón
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

    const memberships = await this.organizationMembershipService.findByUserId(userId);

    const organizationIds = memberships.map(m => m.organizationId);

    return this.organizationModel.find({
      _id: { $in: organizationIds },
    });
  }


  // ADD USER TO ORGANIZATION
  async addUserToOrganization(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMembership> {

    // verificar que la org exista
    await this.findOne(organizationId);

    return this.organizationMembershipService.create({
      userId,
      organizationId,
      organizationRole: OrganizationRole.MEMBER,
    });
  }


  // REMOVE USER FROM ORGANIZATION
  async removeUserFromOrganization(
    organizationId: string,
    userId: string,
  ): Promise<void> {

    // verificar que la org exista
    await this.findOne(organizationId);

    // expulsa al user de todos los proyectos de esa organizacion
    await this.projectMembershipService.deleteFromAllProjectsInOrganization(userId, organizationId)

    // expulsa al user de la organizacion
    await this.organizationMembershipService.deleteByUserAndOrganization(
      userId,
      organizationId,
    );
  }


  // CHANGE USER ROLE
  async changeUserRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMembership> {

    // verificar que exista la membership
    const memberships = await this.organizationMembershipService.findByUserId(userId);

    const membership = memberships.find(
      m => m.organizationId.toString() === organizationId,
    );

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.organizationMembershipService.updateRole(
      membership._id.toString(),
      { organizationRole: role },
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