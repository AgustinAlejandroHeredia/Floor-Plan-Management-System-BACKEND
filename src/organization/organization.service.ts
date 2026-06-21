import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, ForbiddenException, ConflictException } from '@nestjs/common';
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
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';
import { OrganizationWithRoles } from './common/types';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActionType } from 'src/activity-logs/common/types';

@Injectable()
export class OrganizationService {

  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // CREATE
  async create(
    createDto: CreateOrganizationDto,
    userId: string,
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
        })

      } catch (membershipError) {

        await this.organizationModel.findByIdAndDelete(savedOrganization._id)
        console.log('ERROR creando OrganizationMembership:', membershipError);
        throw new InternalServerErrorException(
          'Error creating organization membership for the creator. Organization not created.',
        )

      }

      // ACTIVITY LOG
      this.activityLogsService.create(userId, {
        action: ActionType.CREATE_ORGANIZATION,
        description: `Organization created with the name "${savedOrganization.name}".`,
        targetName: `${savedOrganization.name}`,
        targetId: `${savedOrganization.id}`,
        fields: [
          {key:'organizationName', value:savedOrganization.name}
        ]
      }).catch(logError => {
        console.log("Error creating log for organization creation: ", logError)
      })

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

  // GET ALL ORGANIZATINOS WITH ALL IT MEMBERS EACH
  async getAllOrganizationsWithMembers(
    page: number,
    limit: number,
  ) {

    const skip = (page - 1) * limit;

    const [organizations, totalItems] = await Promise.all([
      this.organizationModel
        .find()
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.organizationModel.countDocuments(),
    ]);

    const organizationsWithMembers = await Promise.all(
      organizations.map(async (organization) => {

        const members =
          await this.organizationMembershipService.findUsersByOrganization(
            organization._id.toString(),
          );

        return {
          ...organization,

          _id: organization._id.toString(),

          members: members.map(member => ({
            _id: member.user._id.toString(),
            name: member.user.name,
            email: member.user.email,
            picture: member.user.picture,
            organizationRole: member.organizationRole,
          })),
        };
      }),
    );

    return {
      list: organizationsWithMembers,

      page,
      limit,

      totalItems,

      totalPages: Math.ceil(
        totalItems / limit,
      ),
    };
  }

  // GET ALL MEMBERS OF THE ORGANIZATION AS ADMIN
  async getOrganizationMemberListAsMember(
    organizationId: string,
    page: number,
    limit: number,
  ) {
    const members =
      await this.organizationMembershipService.findUsersByOrganization(
        organizationId,
      );

    const sortedMembers = members.sort(
      (a, b) =>
        a.user.name.localeCompare(
          b.user.name,
        ),
    );

    const totalItems =
      sortedMembers.length;

    const totalPages =
      Math.ceil(
        totalItems / limit,
      );

    const skip =
      (page - 1) * limit;

    const paginatedMembers =
      sortedMembers
        .slice(
          skip,
          skip + limit,
        )
        .map(
          ({
            user,
            organizationRole,
          }) => ({
            _id:
              user._id.toString(),

            name: user.name,

            email:
              user.email,

            picture:
              user.picture,

            organizationRole:
              organizationRole
                .charAt(0)
                .toUpperCase() +
              organizationRole.slice(
                1,
              ),
          }),
        );

    return {
      list: paginatedMembers,

      page,
      limit,

      totalItems,

      totalPages,
    };
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

  async getOrganizationActionPermissions(organizationId: string): Promise<({
    createPermission: OrganizationActionPermission,
    invitePermission: OrganizationActionPermission,
  })> {
    const organization = await this.organizationModel
      .findById(new Types.ObjectId(organizationId))
      .lean()
    if(!organization){
      throw new NotFoundException("Organization not found")
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
    userId: string,
  ): Promise<OrganizationDocument> {
    const { name, contactEmail, contactPhone } = updateDto

    const conditions: any[] = []
    if (name) conditions.push({ name })
    if (contactEmail) conditions.push({ contactEmail })
    if (contactPhone) conditions.push({ contactPhone })

    if (conditions.length > 0) {
      const conflictingOrg = await this.organizationModel.findOne({
        _id: { $ne: id },
        $or: conditions,
      })

      if (conflictingOrg) {
        if (name && conflictingOrg.name === name) {
          throw new BadRequestException('Organization name already exists')
        }
        if (contactEmail && conflictingOrg.contactEmail === contactEmail) {
          throw new BadRequestException('Organization email already exists')
        }
        if (contactPhone && conflictingOrg.contactPhone === contactPhone) {
          throw new BadRequestException('Organization phone already exists')
        }
      }
    }

    try {
      const updated = await this.organizationModel.findByIdAndUpdate(
        id,
        updateDto,
        { new: true, runValidators: true },
      )

      if (!updated) {
        throw new NotFoundException('Organization not found');
      }

      // ACTIVITY LOG (Fire-and-forget seguro)
      this.activityLogsService.create(userId, {
        action: ActionType.EDIT_ORGANIZATION,
        description: `Organization edited with the name "${updated.name}".`,
        targetName: `${updated.name}`,
        targetId: `${updated.id}`,
        fields: [
          {key:'organizationName', value:updated.name}
        ]
      }).catch(logError => {
        console.log("Error creating log for organization update: ", logError)
      })

      return updated;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Duplicate value for a unique field')
      }
      throw error
    }
  }

  async updateOrganizationActionPermissions(
    id: string,
    updatePermissionsDto: UpdateOrganizationActionPermissionsDto,
    userId: string,
  ): Promise<void> {
    try {

      const current = await this.organizationModel.findById(new Types.ObjectId(id))

      const updated = await this.organizationModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        updatePermissionsDto,
        { new: true, runValidators: true }
      )
      if (!updated) {
        throw new NotFoundException('Organization not found');
      }

      // ACTIVITY LOG
      this.activityLogsService.create(userId, {
        action: ActionType.EDIT_ORGANIZATION_PERMISSIONS,
        description: `Organization edited with the name "${updated.name}". Create permissions "${current?.createPermission}" -> "${updated.createPermission}. Invite permission "${current?.invitePermission}" -> "${updated.invitePermission}".`,
        targetName: `${updated.name}`,
        targetId: `${updated.id}`,
        fields: [
          {key:'organizationName', value:updated.name},
          {key:'oldCreatePermission', value:'current?.createPermission'},
          {key:'newCreatePermission', value:'updated.createPermission'},
          {key:'oldInvitePermission', value:'current?.invitePermission'},
          {key:'newInvitePermission', value:'updated.invitePermission'},
        ]
      }).catch(logError => {
        console.log("Error creating log for organization updateOrganizationActionPermissions: ", logError)
      })

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
    adminUserId?: string,
  ): Promise<OrganizationMembership> {

    // ORG EXISTS?
    const organization = await this.organizationModel.findById(new Types.ObjectId(organizationId));
    if(!organization){
      throw new NotFoundException()
    }

    // DEFAULT : MEMBER
    let role = OrganizationRole.MEMBER
    if(organizationRole) {
      role = organizationRole
    }

    let existingMembership
    
    try {
      const membership = await this.organizationMembershipService.findByUserIdAndOrganizationId(userId, organizationId)
      existingMembership = membership
    } catch (error) {
      existingMembership = null
    }

    if(existingMembership){
      throw new ConflictException()
    }
    
    const orgMembership = await this.organizationMembershipService.create({
      userId,
      organizationId,
      organizationRole: role,
    }).catch(createMembershipError => {
      console.log("Error creating organization membership: ", createMembershipError)
      throw new InternalServerErrorException()
    })

    if(adminUserId){
      // ACTIVITY LOG
      this.activityLogsService.create(adminUserId, {
        action: ActionType.ADD_USER_TO_ORGANIZATION,
        description: `Added user to the orgnaization "${organization.name}".`,
        targetName: "new membership",
        targetId: `${orgMembership._id}`,
        fields: [
          {key:'organizationName', value:organization.name}
        ]
      }).catch(logError => {
        console.log("Error creating log for organization addUserToOrganization: ", logError)
      })
    }


    return orgMembership
  }


  // REMOVE USER FROM ORGANIZATION
  async removeUserFromOrganization(
    organizationId: string,
    userId: string,
    orgAdminUserId?: string,
  ): Promise<void> {

    console.log("REMOVING USER ", userId, " FROM THE ORGANIZATION ", organizationId)

    // verificar que la org exista
    const organization = await this.organizationModel.findOne(new Types.ObjectId(organizationId));
    console.log("ORGANIZATION EXISTS")

    if(!organization){
      throw new NotFoundException("Organization not found")
    }

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

    if(orgAdminUserId){
      // USER WAS KICKED
      this.activityLogsService.create(orgAdminUserId, {
        action: ActionType.KICK_USER_FROM_ORGANIZATION,
        description: `User was kicked from the organization "${organization.name}".`,
        targetName: "kicked user",
        targetId: "deleted membership",
        fields: [
          {key:'organizationName', value:organization.name}
        ]
      }).catch(logError => {
        console.log("Error creating log for organization removeUserFromOrganization - kick user: ", logError)
      })
    } else {
      // USER LEFT
      this.activityLogsService.create(userId, {
        action: ActionType.LEAVE_ORGANIZATION,
        description: `The user left the organization "${organization.name}".`,
        targetName: "user left",
        targetId: "deleted membership",
        fields: [
          {key:'organizationName', value:organization.name}
        ]
      }).catch(logError => {
        console.log("Error creating log for organization removeUserFromOrganization - leave organization: ", logError)
      })
    }
  }


  // CHANGE USER ROLE
  async changeUserRole(
    userId: string,
    organizationId: string,
    orgAdminUserId: string,
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

    // ACTIVITY LOG
    this.activityLogsService.create(orgAdminUserId, {
      action: ActionType.EDIT_ORGANIZATION_USER_ROLE,
      description: `Edit organization user role. User role "${membership.organizationRole}" -> "${currentRole}"`,
      targetName: "edit organization role",
      targetId: `${membership._id}`,
      fields: [
        {key:'oldRole', value:membership.organizationRole},
        {key:'newRole', value:currentRole}
      ]
    })

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

  // GET MY ORGANIZATIONS IN COMMON WITH THIS USER ID
  async getOrganizationsInCommon(
    requestUserId: string,
    userId: string,
  ): Promise<OrganizationWithRoles[]> {

    const [requestUserMemberships, targetUserMemberships] =
      await Promise.all([
        this.organizationMembershipService.findByUserId(
          requestUserId,
        ),
        this.organizationMembershipService.findByUserId(
          userId,
        ),
      ])

    const targetOrganizationIds = new Set(
      targetUserMemberships.map(
        (m) => m.organizationId.toString(),
      ),
    )

    const commonMemberships =
      requestUserMemberships.filter(
        (m) =>
          targetOrganizationIds.has(
            m.organizationId.toString(),
          ),
      )

    const commonOrganizationIds =
      commonMemberships.map(
        (m) => m.organizationId,
      )

    const organizations =
      await this.organizationModel.find({
        _id: { $in: commonOrganizationIds },
      })

    return commonMemberships
      .map((membership) => {

        const organization = organizations.find(
          (org) =>
            org._id.toString() ===
            membership.organizationId.toString(),
        )

        if (!organization) {
          return null
        }

        return {
          organization,
          role: membership.organizationRole,
        }
      })
      .filter(Boolean) as OrganizationWithRoles[]
  }

}