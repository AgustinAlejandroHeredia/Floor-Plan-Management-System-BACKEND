import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { OrganizationRole } from 'src/user/common/role.enum';
import { InjectModel } from '@nestjs/mongoose';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import { Model, Types } from 'mongoose';
import { OrganizationService } from 'src/organization/organization.service';
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class InvitationService {

  constructor(
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
  ) {}

  // 6 digits numeric code
  private createCode() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  async create(
    invitedBy: string, // USER CREATED THE INVITATION
    createInvitationDto: CreateInvitationDto,
  ) {
    console.log("USER ID RECIVED : ", invitedBy)
    try {

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

  findAll() {
    return `This action returns all invitation`;
  }

  findOne(id: number) {
    return `This action returns a #${id} invitation`;
  }

  remove(id: number) {
    return `This action removes a #${id} invitation`;
  }
}
