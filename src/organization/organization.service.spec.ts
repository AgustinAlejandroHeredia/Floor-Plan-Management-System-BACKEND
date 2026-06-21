import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { getModelToken } from '@nestjs/mongoose';
import { Organization } from './schemas/organization.schema';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationActionPermission } from './common/orgPermission.enum';
import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Types } from 'mongoose';
import { OrganizationRole } from 'src/user/common/role.enum';

describe('OrganizationService', () => {

  const userId = '69c30bd8d16ceac57816ee7a'
  const orgAdminId = '69c30bd8d16ceac57816ee7b'
  const orgId = '69c30bd8d16ceac57816ee7c'
  const orgMemId = '69c30bd8d16ceac57816ee7d'

  const dto: CreateOrganizationDto = {
    name: 'Test org',
    address: 'Test address',
    contactEmail: 'Test email',
    contactPhone: '1234567890',
    record: 'Test record',
    adminId: orgAdminId,
    maxBlueprints: 2,
    createPermission: OrganizationActionPermission.ADMINS,
    invitePermission: OrganizationActionPermission.ADMINS,
  }

  let service: OrganizationService

  let saveMock: jest.Mock

  // MODELS
  let mockOrganizationModel: any

  // SERVICES
  let mockOrganizationMembershipService: any
  let mockActivityLogService: any

  beforeEach(async () => {

    jest.clearAllMocks()

    saveMock = jest.fn()

    mockOrganizationModel =
      jest.fn().mockImplementation(
        (data) => ({
          ...data,
          save: saveMock,
        }),
      )
    mockOrganizationModel.find = jest.fn()
    mockOrganizationModel.countDocuments = jest.fn()
    mockOrganizationModel.findById = jest.fn()
    mockOrganizationModel.findOne = jest.fn()
    mockOrganizationModel.findByIdAndUpdate = jest.fn()
    mockOrganizationModel.findByIdAndDelete = jest.fn()

    mockOrganizationMembershipService = {
      create: jest.fn(),
      findUsersByOrganization: jest.fn(),
      findByUserId: jest.fn(),
      deleteByUserAndOrganization: jest.fn(),
      findByUserIdAndOrganizationId: jest.fn(),
      updateRole: jest.fn(),
      getUserRole: jest.fn(),
    }

    mockActivityLogService = {
      create: jest.fn(),
    }

    const module = 
      await Test.createTestingModule({
        providers: [
          OrganizationService,
          {
            provide: getModelToken(Organization.name),
            useValue: mockOrganizationModel,
          },
          {
            provide: OrganizationMembershipService,
            useValue: mockOrganizationMembershipService,
          },
          {
            provide: ActivityLogsService,
            useValue: mockActivityLogService,
          },
        ],
      }).compile()

    service = 
      module.get<OrganizationService>(
        OrganizationService
      )
  })

  
  describe('create', () => {

    it(
      'successfully creates an organization',
      async () => {

        const mockSavedDoc = {
          ...dto,
          _id: { toString: () => orgId },
          id: orgId,
          name: dto.name,
        }

        saveMock.mockResolvedValue(mockSavedDoc)

        mockOrganizationMembershipService
          .create
          .mockResolvedValue({})

        mockActivityLogService
          .create
          .mockResolvedValue({})

        const result = await service.create(
          dto,
          userId,
        )

        expect(saveMock).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.create).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)

        expect(
          result
        ).toMatchObject({
          name: 'Test org',
          address: 'Test address',
          contactEmail: 'Test email',
          contactPhone: '1234567890',
          record: 'Test record',
          adminId: orgAdminId,
          maxBlueprints: 2,
          createPermission: OrganizationActionPermission.ADMINS,
          invitePermission: OrganizationActionPermission.ADMINS,  
        })
      }
    )

    it(
      'successfully rolls back after create() organizationMembership fails',
      async () => {

        const mockSavedDoc = {
          ...dto,
          _id: { toString: () => orgId },
          id: orgId,
          name: dto.name,
        }

        saveMock.mockResolvedValue(mockSavedDoc)

        mockOrganizationMembershipService
          .create
          .mockRejectedValue(new Error('membership db error'))

        mockOrganizationModel
          .findByIdAndDelete
          .mockResolvedValue({})

        mockActivityLogService
          .create
          .mockResolvedValue({})

        await expect (
          service.create(
            dto,
            userId,
          )
        ).rejects.toThrow(InternalServerErrorException)

        expect(saveMock).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.create).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
        expect(mockOrganizationModel.findByIdAndDelete).toHaveBeenCalledTimes(1)
        expect(mockOrganizationModel.findByIdAndDelete).toHaveBeenCalledWith(mockSavedDoc._id)
      }
    )

    it(
      'fails because save() fails',
      async () => {
        saveMock.mockRejectedValue(
          new Error('save fails')
        )
        await expect (
          service.create(
            dto,
            userId,
          )
        ).rejects.toThrow()
      }
    )

  })


  describe('update', () => {

    const updateDto: UpdateOrganizationDto = {
      name: 'New Name',
      contactEmail: 'new@gmail.com',
      contactPhone: '999999999',
    }

    it(
      'successfully updates an organization when there are no conflicts',
      async () => {
        const mockUpdatedDoc = {
          ...dto,
          ...updateDto,
          _id: new Types.ObjectId(orgId),
          id: orgId,
        }

        mockOrganizationModel.findOne.mockResolvedValue(null)

        mockOrganizationModel.findByIdAndUpdate.mockResolvedValue(mockUpdatedDoc)

        mockActivityLogService.create.mockResolvedValue({})

        const result = await service.update(orgId, updateDto, userId)

        expect(mockOrganizationModel.findOne).toHaveBeenCalledWith({
          _id: { $ne: orgId },
          $or: [
            { name: updateDto.name },
            { contactEmail: updateDto.contactEmail },
            { contactPhone: updateDto.contactPhone },
          ],
        })

        expect(mockOrganizationModel.findByIdAndUpdate).toHaveBeenCalledWith(
          orgId,
          updateDto,
          { new: true, runValidators: true },
        )

        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
          name: 'New Name',
          contactEmail: 'new@gmail.com',
        })
      }
    )

    it(
      'fails with BadRequestException because the name already exists',
      async () => {
        
        const conflictingDoc = {
          _id: new Types.ObjectId('69c30bd8d16ceac57816ee7f'),
          name: updateDto.name,
          contactEmail: 'other-email@gmail.com',
          contactPhone: '111111111',
        };

        mockOrganizationModel.findOne.mockResolvedValue(conflictingDoc);

        await expect(
          service.update(orgId, updateDto, userId)
        ).rejects.toThrow(new BadRequestException('Organization name already exists'));

        expect(mockOrganizationModel.findByIdAndUpdate).toHaveBeenCalledTimes(0);
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0);
      }
    );

    it(
      'fails with BadRequestException because the email already exists',
      async () => {
        
        const conflictingDoc = {
          _id: new Types.ObjectId('69c30bd8d16ceac57816ee7f'),
          name: 'Other Name',
          contactEmail: updateDto.contactEmail,
          contactPhone: '111111111',
        };

        mockOrganizationModel.findOne.mockResolvedValue(conflictingDoc);

        await expect(
          service.update(orgId, updateDto, userId)
        ).rejects.toThrow(new BadRequestException('Organization email already exists'));

        expect(mockOrganizationModel.findByIdAndUpdate).toHaveBeenCalledTimes(0);
      }
    );

    it(
      'fails with BadRequestException because the phone already exists',
      async () => {
        
        const conflictingDoc = {
          _id: new Types.ObjectId('69c30bd8d16ceac57816ee7f'),
          name: 'Other Name',
          contactEmail: 'other-email@gmail.com',
          contactPhone: updateDto.contactPhone,
        };

        mockOrganizationModel.findOne.mockResolvedValue(conflictingDoc);

        await expect(
          service.update(orgId, updateDto, userId)
        ).rejects.toThrow(new BadRequestException('Organization phone already exists'));

        expect(mockOrganizationModel.findByIdAndUpdate).toHaveBeenCalledTimes(0);
      }
    );

    it(
      'fails with NotFoundException if the organization to update does not exist',
      async () => {
        
        mockOrganizationModel.findOne.mockResolvedValue(null);
        
        // Pero Mongoose devuelve null al intentar actualizar (no encontró la org por su id)
        mockOrganizationModel.findByIdAndUpdate.mockResolvedValue(null);

        await expect(
          service.update(orgId, updateDto, userId)
        ).rejects.toThrow(new NotFoundException('Organization not found'));

        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0);
      }
    )

  })


  describe('addUserToOrganization', () => {

    it(
      'successfully adds user',
      async () => {

        // organization found
        mockOrganizationModel
          .findById
          .mockResolvedValue({name: 'test org - add user'})

        // membership not found -> user does not belong to this org yet
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue(null)

        // creates membership
        mockOrganizationMembershipService
          .create
          .mockResolvedValue({
            _id: '69c30bd8d16ceac57816ee7d',
            organizationRole: OrganizationRole.MEMBER,
          })

        // log
        mockActivityLogService
          .create
          .mockResolvedValue({})

        const result = await service.addUserToOrganization(
          orgId,
          userId,
          OrganizationRole.MEMBER,
          orgAdminId,
        )

        expect(mockOrganizationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.create).toHaveBeenCalledTimes(1)

        expect(result).toMatchObject({
          organizationRole: OrganizationRole.MEMBER,
        })
      }
    )

    it(
      'fails because org does not exists',
      async () => {

        // organization NOT found
        mockOrganizationModel
          .findById
          .mockResolvedValue(null)

        await expect(
          service.addUserToOrganization(
            orgId,
            userId,
            OrganizationRole.MEMBER,
            orgAdminId,
          )
        ).rejects.toThrow(NotFoundException)

        expect(mockOrganizationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(0)
        expect(mockOrganizationMembershipService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because user is alredy member',
      async () => {

        // organization found
        mockOrganizationModel
          .findById
          .mockResolvedValue({name: 'test org - add user'})

        // membership not found -> user does not belong to this org yet
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue({})

        await expect(
          service.addUserToOrganization(
            orgId,
            userId,
            OrganizationRole.MEMBER,
            orgAdminId,
          )
        ).rejects.toThrow(ConflictException)

        expect(mockOrganizationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because create() fails',
      async () => {

        // organization found
        mockOrganizationModel
          .findById
          .mockResolvedValue({name: 'test org - add user'})

        // membership not found -> user does not belong to this org yet
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue(null)

        mockOrganizationMembershipService
          .create
          .mockRejectedValue()

        await expect(
          service.addUserToOrganization(
            orgId,
            userId,
            OrganizationRole.MEMBER,
            orgAdminId,
          )
        ).rejects.toThrow(InternalServerErrorException)

        expect(mockOrganizationModel.findById).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.findByUserIdAndOrganizationId).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.create).toHaveBeenCalledTimes(1)
      }
    )

  })


  describe('addUserToOrganization', () => {

    it(
      'successfully kicks member from organization',
      async () => {

        // founds organization
        mockOrganizationModel
          .findOne
          .mockResolvedValue({})

        // deletes membership
        mockOrganizationMembershipService
          .deleteByUserAndOrganization
          .mockResolvedValue({})

        // creates log
        mockActivityLogService
          .create
          .mockResolvedValue({})

        await service.removeUserFromOrganization(
            orgId,
            userId,
            orgAdminId,
          )

        expect(mockOrganizationModel.findOne).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.deleteByUserAndOrganization).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)
      }
    )

    it(
      'fails because of organization not found',
      async () => {

        mockOrganizationModel
          .findOne
          .mockResolvedValue(null)

        await expect(
          service.removeUserFromOrganization(
            orgId,
            userId,
            orgAdminId,
          )
        ).rejects.toThrow(NotFoundException)

        expect(mockOrganizationModel.findOne).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.deleteByUserAndOrganization).toHaveBeenCalledTimes(0)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

    it(
      'fails because organizationMembershipService.deleteByUserAndOrganization() fails',
      async () => {

        // founds organization
        mockOrganizationModel
          .findOne
          .mockResolvedValue({})

        // deletes membership
        mockOrganizationMembershipService
          .deleteByUserAndOrganization
          .mockRejectedValue(new NotFoundException())

        await expect(
          service.removeUserFromOrganization(
            orgId,
            userId,
            orgAdminId,
          )
        ).rejects.toThrow(NotFoundException)

        expect(mockOrganizationModel.findOne).toHaveBeenCalledTimes(1)
        expect(mockOrganizationMembershipService.deleteByUserAndOrganization).toHaveBeenCalledTimes(1)
        expect(mockActivityLogService.create).toHaveBeenCalledTimes(0)
      }
    )

  })


})
