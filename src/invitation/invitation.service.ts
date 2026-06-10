import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { OrganizationRole, UserRole } from 'src/user/common/role.enum';
import { InjectModel } from '@nestjs/mongoose';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import { Model, Types } from 'mongoose';
import { OrganizationService } from 'src/organization/organization.service';
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { UserService } from 'src/user/user.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActionType } from 'src/activity-logs/common/types';
import { User, UserDocument } from 'src/user/schemas/user.schema';
import { Organization, OrganizationDocument } from 'src/organization/schemas/organization.schema';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class InvitationService {

  constructor(
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
    private readonly activityLogsService: ActivityLogsService,
    // email module
    private readonly emailService: EmailService,
  ) {}

  // 6 digits numeric code
  private createCode() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  async create(
    invitedById: string,
    invitedByEmail: string,
    createInvitationDto: CreateInvitationDto,
    userGlobalRole: string,
  ) {
    let savedInvitation: InvitationDocument | null = null

    try {

      await this.organizationMembershipService.validateOrganizationAccess(
        invitedById,
        createInvitationDto.organizationId,
        userGlobalRole,
      )

      const isSuperAdmin = userGlobalRole === UserRole.SUPERADMIN

      const [senderMembership, org] = await Promise.all([
        this.organizationMembershipService.findByUserIdAndOrganizationId(
          invitedById,
          createInvitationDto.organizationId,
        ),
        this.organizationService.findOne(
          createInvitationDto.organizationId,
        ),
      ])

      if(invitedByEmail.trim().toLocaleLowerCase() === createInvitationDto.userEmail.trim().toLocaleLowerCase()){
        throw new BadRequestException(
          'You cannot ivite yourself'
        )
      }

      // new condition
      const invitedUserData = await this.userService.findOneByEmail(createInvitationDto.userEmail)

      // new condition
      const invitedUserMembership = await this.organizationMembershipService.findByUserIdAndOrganizationId(
        invitedUserData._id.toString(),
        createInvitationDto.userEmail,
      )

      if(invitedUserMembership){
        throw new ConflictException(
          'User alredy belongs to the organization',
        )
      }

      if (!senderMembership && !isSuperAdmin) {
        throw new ConflictException(
          'Sender user doesnt belong to this organization',
        )
      }

      if (!org) {
        throw new NotFoundException(
          'Organization not found',
        )
      }

      if (
        !isSuperAdmin &&
        org.invitePermission === OrganizationActionPermission.ADMINS &&
        senderMembership.organizationRole !== OrganizationRole.ADMIN
      ) {
        throw new ForbiddenException(
          'No permissions for this action',
        )
      }

      const normalizedEmail =
        createInvitationDto.userEmail
          .trim()
          .toLowerCase()

      const existingInvitation =
        await this.invitationModel.findOne({
          organizationId: new Types.ObjectId(
            createInvitationDto.organizationId,
          ),
          userEmail: normalizedEmail,
        })

      if (existingInvitation) {
        throw new ConflictException(
          'An invitation for this email and organization already exists.',
        )
      }

      let code: string

      do {
        code = this.createCode()
      } while (
        await this.invitationModel.exists({
          accessCode: code,
        })
      )

      savedInvitation =
        await this.invitationModel.create({
          organizationId: new Types.ObjectId(
            createInvitationDto.organizationId,
          ),
          userEmail: normalizedEmail,
          sentByUserId: new Types.ObjectId(
            invitedById,
          ),
          duration:
            createInvitationDto.duration ?? 24,
          userOrganizationRole:
            createInvitationDto.userOrganizationRole ??
            OrganizationRole.MEMBER,
          accessCode: code,
        })

      try {

        await this.emailService.sendEmail(
          savedInvitation.userEmail,
          'Organization Invitation',
          `
            <h2>Organization Invitation</h2>

            <p>
              You have been invited to join the organization
              <strong>${org.name}</strong> on the Floor Plan Management System platform.
            </p>

            <p>
              To accept this invitation, please sign in to your account and navigate to the
              <strong>"Join Organization"</strong> section on the Home page.
            </p>

            <p>
              Enter the invitation token provided below:
            </p>

            <p>
              <strong>${savedInvitation.accessCode}</strong>
            </p>

            <p>
              <strong>Important:</strong> This invitation token will expire
              24 hours after this email is received. Once expired, the token
              can no longer be used and a new invitation must be requested.
            </p>

            <p>
              Once the token has been successfully validated, you will automatically be granted access to the organization and its associated resources according to the permissions assigned to your invitation.
            </p>

            <p>
              If you believe you received this invitation in error, please disregard this email.
            </p>

            <p>
              Kind regards,<br />
              Floor Plan Management System Team
            </p>
          `,
        )

      } catch (emailError) {

        console.error(
          'EMAIL ERROR:',
          emailError,
        )

        await this.invitationModel.findByIdAndDelete(
          savedInvitation._id,
        )

        throw new InternalServerErrorException(
          'Invitation created but email could not be sent',
        )
      }

      await this.activityLogsService.create(
        invitedById,
        {
          action: ActionType.SEND_INVITATION,
          description:
            `Invitation created for "${savedInvitation.userEmail}" with role "${savedInvitation.userOrganizationRole}".`,
          targetName:
            savedInvitation.userEmail,
          targetId:
            savedInvitation._id.toString(),
        },
      )

      return savedInvitation

    } catch (error) {

      console.log(
        'ERROR CREATING INVITATION:',
        error,
      )

      if (error instanceof HttpException) {
        throw error
      }

      throw new InternalServerErrorException(
        'Error creating / sending invitation',
      )
    }
  }

  async getInvitationByCode(
    code: string,
  ) {
    return this.invitationModel
      .findOne({ accessCode: code })
  }

  async validateInvitation(
    userId: string,
    code: string,
  ) {

    const invitation = await this.getInvitationByCode(code)
    if(!invitation){
      console.log("Invitation with code ", code, " does not exists, user asking is ", userId)
      throw new BadRequestException(
        'Invalid invitation',
      )
    }

    const invitedUserData = await this.userService.findOne(userId)
    
    if(
      invitedUserData && (
        invitation.userEmail.trim().toLowerCase() !==
        invitedUserData.email.trim().toLowerCase()
      )
    ){
      console.log("Email asking for invitation: ", invitedUserData.email, ", and email on invitation: ", invitation.userEmail)
      throw new BadRequestException(
        'Invalid invitation',
      )
    }

    try {

      // EXPIRED?
      const now = new Date();
      const hoursPassed = (now.getTime() - invitation.creationDate.getTime()) / (1000 * 60 * 60)
      if(hoursPassed >= invitation.duration){
        await this.invitationModel.deleteOne({ _id: invitation._id})
        throw new BadRequestException(
          'Invitation expired.',
        )
      }

      await this.organizationService.addUserToOrganization(
        invitation.organizationId.toString(),
        userId,
        invitation.userOrganizationRole,
      )

      await this.invitationModel.deleteOne({ _id: invitation._id})

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Something went wrong adding user to organization.',
      )
    }
  }

  async remove(
    id: string,
    userId: string,
    userGlobalRole: string,
  ) {
    const invitation = await this.invitationModel.findById(id)

    if (!invitation) {
      throw new NotFoundException('Invitation not found')
    }

    // user belongs to this organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, invitation.organizationId.toString(), userGlobalRole)

    const userMembership =
      await this.organizationMembershipService
        .findByUserIdAndOrganizationId(
          userId,
          invitation.organizationId.toString(),
        )

    const isSuperAdmin =
      userGlobalRole === UserRole.SUPERADMIN

    const isOrgAdmin =
      userMembership?.organizationRole ===
      OrganizationRole.ADMIN

    if (!isSuperAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'access denied',
      )
    }

    // ACTIVITY LOG
    this.activityLogsService.create(userId, {
      action: ActionType.SEND_INVITATION,
      description: `Invitation deleted for the user with emal "${invitation.userEmail}" with "${invitation.userOrganizationRole}" role.`,
      targetName: `${invitation.userEmail}`,
      targetId: `${invitation.id}`
    })

    await this.invitationModel.findByIdAndDelete(new Types.ObjectId(id))

    return {message: 'Invitation deleted successfully'}
  }

  async getAllInvitations(
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit

    const [invitations, totalItems] =
      await Promise.all([
        this.invitationModel
          .find()
          .sort({ creationDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        this.invitationModel.countDocuments(),
      ])

    if (!invitations.length) {
      return {
        list: [],
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(
          totalItems / limit,
        ),
      }
    }

    const organizationIds = [
      ...new Set(
        invitations.map(inv =>
          inv.organizationId.toString(),
        ),
      ),
    ]

    const userIds = [
      ...new Set(
        invitations.map(inv =>
          inv.sentByUserId.toString(),
        ),
      ),
    ]

    const [organizations, users] =
      await Promise.all([
        this.organizationModel
          .find(
            {
              _id: {
                $in: organizationIds,
              },
            },
            { name: 1 },
          )
          .lean(),

        this.userModel
          .find(
            {
              _id: {
                $in: userIds,
              },
            },
            { name: 1 },
          )
          .lean(),
      ])

    const organizationMap = new Map(
      organizations.map(org => [
        org._id.toString(),
        org.name,
      ]),
    )

    const userMap = new Map(
      users.map(user => [
        user._id.toString(),
        user.name,
      ]),
    )

    return {
      list: invitations.map(inv => {

        const expired =
          Date.now() -
            new Date(
              inv.creationDate,
            ).getTime() >=
          inv.duration * 60 * 60 * 1000

        return {
          _id: inv._id.toString(),

          organizationId:
            inv.organizationId.toString(),

          organizationName:
            organizationMap.get(
              inv.organizationId.toString(),
            ) ??
            'Unknown organization',

          userEmail: inv.userEmail,

          sentByUserId:
            inv.sentByUserId.toString(),

          sentByUserName:
            userMap.get(
              inv.sentByUserId.toString(),
            ) ?? 'Unknown user',

          creationDate:
            inv.creationDate,

          duration: inv.duration,

          userOrganizationRole:
            inv.userOrganizationRole,

          expired,
        }
      }),

      page,
      limit,

      totalItems,

      totalPages: Math.ceil(
        totalItems / limit,
      ),
    }
  }

  async refreshInvitation(
    invitationId: string,
  ) {
    const invitation = await this.invitationModel.findByIdAndUpdate(
      invitationId,
      {
        creationDate: new Date(),
      },
      {
        new: true,
      },
    )

    if (!invitation) {
      throw new NotFoundException('Invitation not found')
    }

    return invitation
  }

  async getOrganizationInvitations(
    organizationId: string,
    page: number,
    limit: number,
  ) {

    const skip = (page - 1) * limit

    const filter = {
      organizationId: new Types.ObjectId(
        organizationId,
      ),
    }

    const [
      invitations,
      totalItems,
      organization,
    ] = await Promise.all([
      this.invitationModel
        .find(filter)
        .sort({ creationDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.invitationModel.countDocuments(
        filter,
      ),

      this.organizationModel
        .findById(
          organizationId,
          { name: 1 },
        )
        .lean(),
    ])

    if (!invitations.length) {
      return {
        list: [],

        page,
        limit,

        totalItems,

        totalPages: Math.ceil(
          totalItems / limit,
        ),
      }
    }

    const userIds = [
      ...new Set(
        invitations.map(inv =>
          inv.sentByUserId.toString(),
        ),
      ),
    ]

    const users = await this.userModel
      .find(
        {
          _id: { $in: userIds },
        },
        {
          name: 1,
        },
      )
      .lean()

    const userMap = new Map(
      users.map(user => [
        user._id.toString(),
        user.name,
      ]),
    )

    const list = invitations.map(inv => {

      const expired =
        Date.now() -
          new Date(
            inv.creationDate,
          ).getTime() >=
        inv.duration *
          60 *
          60 *
          1000

      return {
        _id: inv._id.toString(),

        organizationId:
          inv.organizationId.toString(),

        organizationName:
          organization?.name ??
          'Unknown organization',

        userEmail: inv.userEmail,

        sentByUserId:
          inv.sentByUserId.toString(),

        sentByUserName:
          userMap.get(
            inv.sentByUserId.toString(),
          ) ?? 'Unknown user',

        creationDate:
          inv.creationDate,

        duration: inv.duration,

        userOrganizationRole:
          inv.userOrganizationRole,

        expired,
      }
    })

    return {
      list,

      page,
      limit,

      totalItems,

      totalPages: Math.ceil(
        totalItems / limit,
      ),
    }
  }

}
