import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { OrganizationRole } from 'src/user/common/role.enum';
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
  ) {}

  // 6 digits numeric code
  private createCode() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  async create(
    invitedBy: string, // USER CREATED THE INVITATION
    createInvitationDto: CreateInvitationDto,
    userGlobalRole: string,
  ) {
    console.log("USER ID RECIVED : ", invitedBy)
    try {

      // user belongs to this organization?
      await this.organizationMembershipService.validateOrganizationAccess(invitedBy, createInvitationDto.organizationId, userGlobalRole)

      // SENDER BELONGS TO THE ORGANIZATION
      const senderMembership = await this.organizationMembershipService.findByUserIdAndOrganizationId(invitedBy, createInvitationDto.organizationId)
      if(!senderMembership){
        throw new ConflictException(
          'User doesnt belong to this organization',
        )
      }

      // INVITED USER DOES NOT BELONGS ALREDY TO THE ORGANIZATION
      

      // GETS ORGANIZATION INVITE PERMISION
      const orgPermissions = await this.organizationService.getOrganizationActionPermissions(createInvitationDto.organizationId)
      const orgInvitePermission = orgPermissions.invitePermission

      // CHECKS IF THE PERMISSIONS ARE RIGHT (if organizacion invite permissions are "admins", an user with organizacionRole "member" is invalid)
      if(
        orgInvitePermission === OrganizationActionPermission.ADMINS &&
        senderMembership.organizationRole !== OrganizationRole.ADMIN
      ){
        throw new InternalServerErrorException(
          'No permissions for this action',
        )
      }

      const existingInvitation = await this.invitationModel.findOne({
        organizationId: new Types.ObjectId(createInvitationDto.organizationId),
        userEmail: createInvitationDto.userEmail.trim().toLocaleLowerCase()
      })
      console.log("INVITATION FOUND : ", existingInvitation)

      if(existingInvitation){
        console.log("INVITATION ALREDY EXISTS")
        throw new ConflictException('An invitation for this email and organization alredy exists.')
      }
      console.log("INVITATION DOES NOT EXISTS")

      // MAKES SURE THAT CODE DOES NOT COLLIDE / OVERLAPS WITH ANOTHER THAT EXISTS
      let code = ''
      do {
        code = this.createCode();
      } while (
        await this.invitationModel.exists({
          accessCode: code,
        })
      )

      const invitation = new this.invitationModel({

        organizationId: new Types.ObjectId(
          createInvitationDto.organizationId,
        ),

        userEmail: createInvitationDto.userEmail.trim().toLowerCase(),

        sentByUserId: new Types.ObjectId(invitedBy),

        duration: createInvitationDto.duration ?? 24,

        userOrganizationRole:
          createInvitationDto.userOrganizationRole ??
          OrganizationRole.MEMBER,

        accessCode: code,
      })

      const savedInvitation = await invitation.save()

      // ACTIVITY LOG
      this.activityLogsService.create(invitedBy, {
        action: ActionType.SEND_INVITATION,
        description: `Invitation craeted for the user with emal "${savedInvitation.userEmail}" with "${savedInvitation.userOrganizationRole}" role.`,
        targetName: `${savedInvitation.userEmail}`,
        targetId: `${savedInvitation.id}`
      })

      return savedInvitation;

    } catch (error) {
      console.log('ERROR CREATING INVITATION:', error)
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error creating invitation',
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
      invitation.userEmail.trim().toLowerCase() !==
      invitedUserData.email.trim().toLowerCase()
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
      );
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

  async getAllInvitations() {
    const invitations = await this.invitationModel
      .find()
      .sort({ creationDate: -1 })
      .lean()

    if (!invitations.length) {
      return []
    }

    // Organizations
    const organizationIds = [
      ...new Set(
        invitations.map(inv => inv.organizationId.toString())
      ),
    ]

    // Users
    const userIds = [
      ...new Set(
        invitations.map(inv => inv.sentByUserId.toString())
      ),
    ]

    const [organizations, users] = await Promise.all([
      this.organizationModel.find(
        { _id: { $in: organizationIds } },
        { name: 1 },
      ).lean(),

      this.userModel.find(
        { _id: { $in: userIds } },
        { name: 1 },
      ).lean(),
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

    return invitations.map(inv => {

      const expired =
        Date.now() - new Date(inv.creationDate).getTime() >=
        inv.duration * 60 * 60 * 1000;

      return {
        _id: inv._id.toString(),

        organizationId: inv.organizationId.toString(),
        organizationName:
          organizationMap.get(inv.organizationId.toString()) ??
          'Unknown organization',

        userEmail: inv.userEmail,

        sentByUserId: inv.sentByUserId.toString(),
        sentByUserName:
          userMap.get(inv.sentByUserId.toString()) ??
          'Unknown user',

        creationDate: inv.creationDate,
        duration: inv.duration,
        userOrganizationRole: inv.userOrganizationRole,

        expired,
      }
    })
  }
}
