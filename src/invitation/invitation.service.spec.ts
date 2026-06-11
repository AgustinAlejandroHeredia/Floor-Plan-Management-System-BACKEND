import { Test } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { getModelToken } from '@nestjs/mongoose';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import { OrganizationRole, UserRole } from 'src/user/common/role.enum';
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';
import { Types } from 'mongoose';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { EmailService } from 'src/email/email.service';
import { User } from 'src/user/schemas/user.schema';
import { UserService } from 'src/user/user.service';
import { Organization } from 'src/organization/schemas/organization.schema';
import { OrganizationService } from 'src/organization/organization.service';
import { ActionType } from 'src/activity-logs/common/types';
import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';

describe('InvitationService', () => {

  const userId = '69c30bd8d16ceac57816ee7a'
  const invitedId = '69c30bd8d16ceac57816ee7f'
  const orgId = '69c30bd8d16ceac57816ee7b'
  const orgMemId = '69c30bd8d16ceac57816ee7c'
  const invitationId = '69c30bd8d16ceac57816ee7d'

  let service: InvitationService;

  // MODELS
  let mockInvitationModel: any
  let mockUserModel: any
  let mockOrganizationModel: any

  // SERVICES
  let mockUserService: any
  let mockOrganizationService: any
  let mockOrganizationMembershipService: any
  let mockEmailService: any
  let mockActivityLogService: any

  beforeEach(async () => {

    jest.clearAllMocks()

    mockInvitationModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      exists: jest.fn(),
      findByIdAndDelete: jest.fn(),
      deleteOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    }

    mockEmailService = {
      sendEmail: jest.fn(),
    }

    mockOrganizationMembershipService = {
        validateOrganizationAccess: jest.fn(),
        findByUserIdAndOrganizationId: jest.fn(),
    }

    mockActivityLogService = {
      create: jest.fn(),
    }

    mockUserModel = {}

    mockUserService = {
      findOne: jest.fn(),
      findOneByEmail: jest.fn(),
    }

    mockOrganizationModel = {}

    mockOrganizationService ={
      findOne: jest.fn(),
      addUserToOrganization: jest.fn(),
    }

    const module = 
      await Test.createTestingModule({
        providers: [
          InvitationService,
          {
            provide: getModelToken(Invitation.name),
            useValue: mockInvitationModel,
          },
          {
            provide: OrganizationMembershipService,
            useValue: mockOrganizationMembershipService,
          },
          {
            provide: ActivityLogsService,
            useValue: mockActivityLogService,
          },
          {
            provide: EmailService,
            useValue: mockEmailService,
          },
          {
            provide: getModelToken(User.name),
            useValue: mockUserModel,
          },
          {
            provide: getModelToken(Organization.name),
            useValue: mockOrganizationModel,
          },
          {
            provide: UserService,
            useValue: mockUserService,
          },
          {
            provide: OrganizationService,
            useValue: mockOrganizationService,
          },
        ],
      }).compile();

    service = 
      module.get<InvitationService>(
        InvitationService
      )
  })

  describe('create', () => {

    it(
      'successfully creates invitation ( globalRole = none / orgRole = member / belongs = true )',
      async () => {

        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        // implementacion dinamica : busqueda de membership
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            return null // returns null for the invited user
          })

        // organization found
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.MEMBERS,
          })

        // NEW CONDITION
        mockUserService
          .findOneByEmail
          .mockResolvedValue({
            _id: new Types.ObjectId(invitedId)
          })

        // no existing invitation for the email and organizationId
        mockInvitationModel
          .findOne
          .mockResolvedValue(null)

        // invitation with this code does not exists
        mockInvitationModel
          .exists
          .mockResolvedValue(null)

        // creates invitation
        const savedInvitation = {
          _id: new Types.ObjectId(invitationId),
          userEmail: 'inviteduseremail@gmail.com',
          accessCode: '123456',
          userOrganizationRole: OrganizationRole.MEMBER,
          duration: 24,
        }

        mockInvitationModel.create.mockResolvedValue(savedInvitation)

        // sends email successfully
        mockEmailService
          .sendEmail
          .mockResolvedValue(undefined)

        // creates activity log
        mockActivityLogService
          .create
          .mockResolvedValue(undefined)

        const result = await service.create(
          '69c30bd8d16ceac57816ee7a',
          'sender@gmail.com',
          {
            organizationId: orgId,
            userEmail: 'inviteduseremail@gmail.com',
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
          },
          UserRole.NONE
        )

        expect(mockInvitationModel.create).toHaveBeenCalledTimes(1)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)

        expect(result).toMatchObject({
          _id: new Types.ObjectId(invitationId),
          userEmail: 'inviteduseremail@gmail.com',
          accessCode: '123456',
          duration: 24,
          userOrganizationRole: OrganizationRole.MEMBER,
        })
      }
    )

    it(
      'successfully creates invitation ( globalRole = super_admin / orgRole = - / belongs = false )',
      async () => {

        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        // implementacion dinamica : busqueda de membership
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            return null // returns null for the invited user
          })

        // organization found
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.MEMBERS,
          })

        // user found by email
        mockUserService
          .findOneByEmail
          .mockResolvedValue({
            _id: new Types.ObjectId(invitedId)
          })

        // no existing invitation for the email and organizationId
        mockInvitationModel
          .findOne
          .mockResolvedValue(null)

        // invitation with this code does not exists
        mockInvitationModel
          .exists
          .mockResolvedValue(null)

        // creates invitation
        const savedInvitation = {
          _id: new Types.ObjectId(invitationId),
          userEmail: 'inviteduseremail@gmail.com',
          accessCode: '123456',
          userOrganizationRole: OrganizationRole.MEMBER,
          duration: 24,
        }

        mockInvitationModel.create.mockResolvedValue(savedInvitation)

        // sends email successfully
        mockEmailService
          .sendEmail
          .mockResolvedValue(undefined)

        // creates activity log
        mockActivityLogService
          .create
          .mockResolvedValue(undefined)

        const result = await service.create(
          '69c30bd8d16ceac57816ee7a',
          'sender@gmail.com',
          {
            organizationId: orgId,
            userEmail: 'inviteduseremail@gmail.com',
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
          },
          UserRole.SUPERADMIN
        )

        expect(mockInvitationModel.create).toHaveBeenCalledTimes(1)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)

        expect(result).toMatchObject({
          _id: new Types.ObjectId(invitationId),
          userEmail: 'inviteduseremail@gmail.com',
          accessCode: '123456',
          duration: 24,
          userOrganizationRole: OrganizationRole.MEMBER,
        })
      }
    )

    it(
      'fails because of user does not belong to the organization ( globalRole = none / orgRole = - / belongs = false )',
      async () => {

        // invalid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockRejectedValue(new ForbiddenException("Access denied, user does not belog to the organization"))

        await expect(
          service.create(
            '69c30bd8d16ceac57816ee7a',
            'sender@gmail.com',
            {
              organizationId: orgId,
              userEmail: 'inviteduseremail@gmail.com',
              duration: 24,
              userOrganizationRole: OrganizationRole.MEMBER,
            },
            UserRole.SUPERADMIN
          )
        ).rejects.toThrow(ForbiddenException)

        expect(mockInvitationModel.create).toHaveBeenCalledTimes(0)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(0)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because only org admins can send invitations ( globalRole = none / orgRole = member / belongs = true )',
      async () => {

        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER // El remitente es MEMBER
              }
            }
            return null
          })

        // organization found - send invitations only admins
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.ADMINS,
          })

        // user found by email
        mockUserService
          .findOneByEmail
          .mockResolvedValue({
            _id: new Types.ObjectId(invitedId)
          })

        await expect(
          service.create(
            '69c30bd8d16ceac57816ee7a',
            'sender@gmail.com',
            {
              organizationId: orgId,
              userEmail: 'inviteduseremail@gmail.com',
              duration: 24,
              userOrganizationRole: OrganizationRole.MEMBER,
            },
            UserRole.NONE
          )
        ).rejects.toThrow(ForbiddenException)

        expect(mockInvitationModel.create).toHaveBeenCalledTimes(0)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(0)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because of existing invitation for this user to this organization',
      async () => {
        
        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            return null
          })

        // organization found
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.MEMBERS,
          })

        // finds user by email
        mockUserService
          .findOneByEmail
          .mockResolvedValue({
            _id: new Types.ObjectId(invitedId)
          })

        // alredy EXISTING invitation for the email and organizationId
        mockInvitationModel
          .findOne
          .mockResolvedValue({
            _id: orgId,
          })

        await expect(
          service.create(
            '69c30bd8d16ceac57816ee7a',
            'sender@gmail.com',
            {
              organizationId: orgId,
              userEmail: 'inviteduseremail@gmail.com',
              duration: 24,
              userOrganizationRole: OrganizationRole.MEMBER,
            },
            UserRole.NONE
          )
        ).rejects.toThrow(ConflictException)

        expect(mockInvitationModel.create).toHaveBeenCalledTimes(0)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(0)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails sending email but successfully rolls back the invitation',
      async () => {

        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            return null
          })

        // organization found
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.MEMBERS,
          })

        // finds user by email
        mockUserService
          .findOneByEmail
          .mockResolvedValue({
            _id: new Types.ObjectId(invitedId)
          })

        // no existing invitation for the email and organizationId
        mockInvitationModel
          .findOne
          .mockResolvedValue(null)

        // invitation with this code does not exists
        mockInvitationModel
          .exists
          .mockResolvedValue(null)

        // creates invitation
        const savedInvitation = {
          _id: new Types.ObjectId(invitationId),
          userEmail: 'inviteduseremail@gmail.com',
          accessCode: '123456',
          userOrganizationRole: OrganizationRole.MEMBER,
          duration: 24,
        }

        mockInvitationModel.create.mockResolvedValue(savedInvitation)

        // sends email FAILS
        mockEmailService
          .sendEmail
          .mockRejectedValue(
            new Error('send email fails')
          )

        // deletes created invitation
        mockInvitationModel
          .findByIdAndDelete
          .mockResolvedValue(null)

        // creates activity log
        mockActivityLogService
          .create
          .mockResolvedValue(undefined)

        await expect(
          service.create(
            '69c30bd8d16ceac57816ee7a',
            'sender@gmail.com',
            {
              organizationId: orgId,
              userEmail: 'inviteduseremail@gmail.com',
              duration: 24,
              userOrganizationRole: OrganizationRole.MEMBER,
            },
            UserRole.NONE
          )
        ).rejects.toThrow(InternalServerErrorException)

        expect(mockInvitationModel.create).toHaveBeenCalledTimes(1)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
        expect(mockInvitationModel.findByIdAndDelete).toHaveBeenCalledTimes(1)
      }
    )

    it(
      'fails because user is inviting by itself',
      async () => {

        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        // membership
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            return null
          })

        // organization found
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.MEMBERS,
          })

        await expect(
          service.create(
            '69c30bd8d16ceac57816ee7a',
            'sender@gmail.com',
            {
              organizationId: orgId,
              userEmail: 'sender@gmail.com',
              duration: 24,
              userOrganizationRole: OrganizationRole.MEMBER,
            },
            UserRole.NONE
          )
        ).rejects.toThrow(BadRequestException)

        expect(mockUserService.findOneByEmail).toHaveBeenCalledTimes(0)
        expect(mockInvitationModel.create).toHaveBeenCalledTimes(0)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(0)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because user alredy belongs to this organization',
      async () => {

        // valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(undefined)

        // membership
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockImplementation(async (userIdParam: string, secondParam: string) => {
            if (userIdParam === '69c30bd8d16ceac57816ee7a') {
              return {
                _id: orgMemId,
                userId: '69c30bd8d16ceac57816ee7a',
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            if (userIdParam === invitedId) {
              return {
                _id: '69c30bd8d16ceac57816ee7e',
                userId: invitedId,
                organizationId: orgId,
                organizationRole: OrganizationRole.MEMBER
              }
            }
            return null
          })

        // organization found
        mockOrganizationService
          .findOne
          .mockResolvedValue({
            _id: orgId,
            name: 'Test Org',
            invitePermission: OrganizationActionPermission.MEMBERS,
          })
        
        mockUserService
          .findOneByEmail
          .mockResolvedValue({
            _id: new Types.ObjectId(invitedId)
          })

        await expect(
          service.create(
            '69c30bd8d16ceac57816ee7a',
            'sender@gmail.com',
            {
              organizationId: orgId,
              userEmail: 'inviteduseremail@gmail.com',
              duration: 24,
              userOrganizationRole: OrganizationRole.MEMBER,
            },
            UserRole.NONE
          )
        ).rejects.toThrow(ConflictException)

        expect(mockUserService.findOneByEmail).toHaveBeenCalledTimes(1)
        expect(mockInvitationModel.findOne).toHaveBeenCalledTimes(0)
        expect(mockInvitationModel.create).toHaveBeenCalledTimes(0)
        expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(0)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

  })

  describe('validateInvitation', () => {

    it(
      'successfully validates the code',
      async () => {

        // obtains invitation with code
        jest
          .spyOn(service, 'getInvitationByCode')
          .mockResolvedValue({
            _id: new Types.ObjectId(invitationId),
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(Date.now() - 60 * 60 * 1000),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
            __v: 0,
          } as any)

        // obtains user
        mockUserService
          .findOne
          .mockResolvedValue({
            authProviderId: 'provider id',
            email: 'test@gmail.com',
            name: 'user name',
            picture: 'picture url',
            globalRole: UserRole.NONE,
            joinedAt: Date.now()
          })

        // adds user to organization
        mockOrganizationService
          .addUserToOrganization
          .mockResolvedValue(null)

        // is not expired -> deletes invitation
        mockInvitationModel
          .deleteOne
          .mockResolvedValue(null)

        const result = await service.validateInvitation(
          userId,
          '123456',
        )

        expect(mockUserService.findOne).toHaveBeenCalledWith(userId)
        expect(mockOrganizationService.addUserToOrganization).toHaveBeenCalledTimes(1)
        expect(mockInvitationModel.deleteOne).toHaveBeenCalledTimes(1)

        expect(result).toBeUndefined()
      }
    )

    it(
      'successfully deletes invitation after is expired',
      async () => {

        // obtains invitation with code - is expired by 24h
        jest
          .spyOn(service, 'getInvitationByCode')
          .mockResolvedValue({
            _id: new Types.ObjectId(invitationId),
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
            __v: 0,
          } as any)

        // obtains user
        mockUserService
          .findOne
          .mockResolvedValue({
            authProviderId: 'provider id',
            email: 'test@gmail.com',
            name: 'user name',
            picture: 'picture url',
            globalRole: UserRole.NONE,
            joinedAt: Date.now()
          })

        mockInvitationModel
          .deleteOne
          .mockResolvedValue({ deletedCount: 1 })

        await expect(
          service.validateInvitation(
            userId,
            '123456',
          )
        ).rejects.toThrow(BadRequestException)

        expect(mockInvitationModel.deleteOne).toHaveBeenCalledTimes(1) 
        expect(mockInvitationModel.deleteOne).toHaveBeenCalledWith({ _id: new Types.ObjectId(invitationId) })
        expect(mockOrganizationService.addUserToOrganization).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because of code does not exists',
      async () => {

        // invitation NOT found
        jest
          .spyOn(service, 'getInvitationByCode')
          .mockResolvedValue(null)

        await expect(
          service.validateInvitation(
            userId,
            '123456',
          )
        ).rejects.toThrow(BadRequestException)

        expect(mockUserService.findOne).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because the user email does not match the invitation email',
      async () => {

        jest
          .spyOn(service, 'getInvitationByCode')
          .mockResolvedValue({
            _id: new Types.ObjectId(invitationId),
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'target-user@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
            __v: 0,
          } as any)

        mockUserService
          .findOne
          .mockResolvedValue({
            authProviderId: 'provider id',
            email: 'intruder-user@gmail.com',
            name: 'intruder',
            globalRole: UserRole.NONE,
            joinedAt: Date.now()
          })

        await expect(
          service.validateInvitation(
            userId,
            '123456',
          )
        ).rejects.toThrow(new BadRequestException('Invalid invitation'))

        expect(mockUserService.findOne).toHaveBeenCalledWith(userId)
        expect(mockOrganizationService.addUserToOrganization).toHaveBeenCalledTimes(0)
        expect(mockInvitationModel.deleteOne).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because database breaks during user insertion and throws InternalServerErrorException without deleting the invitation',
      async () => {

        jest
          .spyOn(service, 'getInvitationByCode')
          .mockResolvedValue({
            _id: new Types.ObjectId(invitationId),
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
            __v: 0,
          } as any)

        mockUserService
          .findOne
          .mockResolvedValue({
            email: 'test@gmail.com',
            globalRole: UserRole.NONE,
          })

        mockOrganizationService
          .addUserToOrganization
          .mockRejectedValue(new Error('DB Connection lost'))

        await expect(
          service.validateInvitation(userId, '123456')
        ).rejects.toThrow(InternalServerErrorException)

        expect(mockOrganizationService.addUserToOrganization).toHaveBeenCalledTimes(1)
        expect(mockInvitationModel.deleteOne).toHaveBeenCalledTimes(0)
      }
    )

  })

  describe('remove', () => {

    it(
      'successfully removed invitation ( member: true , globalRole: none )',
      async () => {

        // finds invitation
        mockInvitationModel
          .findById
          .mockResolvedValue({
            id: invitationId,
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
          })

        // user valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(null)

        // finds user membership - organization admin
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue({
            organizationRole: OrganizationRole.ADMIN,
          })

        // creates activity log
        mockActivityLogService
          .create
          .mockResolvedValue(null)

        // deletes used invitation
        mockInvitationModel
          .findByIdAndDelete
          .mockResolvedValue(null)

        const result = await service.remove(
          invitationId,
          userId,
          UserRole.NONE,
        )

        expect(mockInvitationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.validateOrganizationAccess).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)
        expect(mockInvitationModel.findByIdAndDelete).toHaveBeenCalledTimes(1)

        expect(result).toMatchObject({message: 'Invitation deleted successfully'})
      }
    )

    it(
      'successfully removed invitation ( member: false , globalRole: super_admin )',
      async () => {

        // finds invitation
        mockInvitationModel
          .findById
          .mockResolvedValue({
            id: invitationId,
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
          })

        // user valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(null)

        // membership NOT found
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue(null)

        // creates activity log
        mockActivityLogService
          .create
          .mockResolvedValue(null)

        // deletes used invitation
        mockInvitationModel
          .findByIdAndDelete
          .mockResolvedValue(null)

        const result = await service.remove(
          invitationId,
          userId,
          UserRole.SUPERADMIN,
        )

        expect(mockInvitationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.validateOrganizationAccess).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)
        expect(mockInvitationModel.findByIdAndDelete).toHaveBeenCalledTimes(1)

        expect(result).toMatchObject({message: 'Invitation deleted successfully'})
      }
    )

    it(
      'fails because user is member (only org admins o super admins can access)',
      async () => {

        // finds invitation
        mockInvitationModel
          .findById
          .mockResolvedValue({
            id: invitationId,
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
          })

        // user valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockResolvedValue(null)

        // finds user membership - organization member
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue({
            organizationRole: OrganizationRole.MEMBER,
          })

        await expect(
          service.remove(
            invitationId,
            userId,
            UserRole.NONE,
          )
        ).rejects.toThrow(ForbiddenException)

        expect(mockInvitationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.validateOrganizationAccess).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(1)
      }
    )

    it(
      'fails because user has no membership with this organization',
      async () => {

        // finds invitation
        mockInvitationModel
          .findById
          .mockResolvedValue({
            id: invitationId,
            organizationId: new Types.ObjectId(orgId),
            userEmail: 'test@gmail.com',
            sentByUserId: new Types.ObjectId(userId),
            creationDate: new Date(),
            duration: 24,
            userOrganizationRole: OrganizationRole.MEMBER,
            accessCode: '123456',
          })

        // user valid access
        mockOrganizationMembershipService
          .validateOrganizationAccess
          .mockRejectedValue(
            new Error('validation denied')
          )

        await expect(
          service.remove(
            invitationId,
            userId,
            UserRole.NONE,
          )
        ).rejects.toThrow()

        expect(mockInvitationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.validateOrganizationAccess).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(0)
      }
    )

  })

})
