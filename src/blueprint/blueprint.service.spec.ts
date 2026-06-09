import { Test, TestingModule } from '@nestjs/testing';
import { BlueprintService } from './blueprint.service';
import { getModelToken } from '@nestjs/mongoose';
import { Blueprint } from './schemas/blueprint.schema';
import { Organization } from 'src/organization/schemas/organization.schema';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { ThumbnailService } from 'src/thumbnail/thumbnail.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UserRole } from 'src/user/common/role.enum';
import { Project } from 'src/project/schemas/project.schema';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { rejects } from 'assert';

describe('BlueprintService', () => {

  const test_user_id_string = '69c30bd8d16ceac57816ee7a'

  let service: BlueprintService;

  let saveMock: jest.Mock

  let mockBlueprintModel: any

  let mockOrganizationMembershipService: any
  let mockStorageService: any
  let mockThumbnailService: any
  let mockActivityLogService: any
  let mockOrganizationModel: any
  let mockProjectModel: any

  beforeEach(async () => {

    jest.clearAllMocks()

    saveMock = jest.fn()

    mockBlueprintModel = 
      jest.fn().mockImplementation(
        (data) => ({
          ...data,
          save: saveMock
        })
      )

    mockOrganizationMembershipService = {
      findByUserIdAndOrganizationId: jest.fn()
    }

    mockStorageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    }

    mockThumbnailService = {
      createThumbnail: jest.fn(),
      getThumbnailName: jest.fn(),
    }

    mockActivityLogService = {
      create: jest.fn()
    }

    mockOrganizationModel = {
      findById: jest.fn()
    }

    const module = 
      await Test.createTestingModule({
        providers: [
          BlueprintService,
          {
            provide: getModelToken(Blueprint.name),
            useValue: mockBlueprintModel,
          },
          {
            provide: getModelToken(Organization.name),
            useValue: mockOrganizationModel,
          },
          {
            provide: getModelToken(Project.name),
            useValue: mockProjectModel,
          },
          {
            provide: OrganizationMembershipService,
            useValue: mockOrganizationMembershipService,
          },
          {
            provide: FileStorageService,
            useValue: mockStorageService,
          },
          {
            provide: ThumbnailService,
            useValue: mockThumbnailService,
          },
          {
            provide: ActivityLogsService,
            useValue: mockActivityLogService,
          },
        ],
    }).compile()

    service =
      module.get<BlueprintService>(
        BlueprintService,
      )
    })


    describe('create', () => {

      it(
        'should create a new blueprint successfully',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue({
              test_user_id_string,
              organizationId: dto.organizationId,
            })

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(3)

          // uploadFile is being called 2 times
          mockStorageService
            .uploadFile
            .mockResolvedValueOnce({
              id: 'file id',
              name: 'storedfile.png',
            })
            .mockResolvedValueOnce({
              id: 'thumbnail id',
              name: 'thumbnailfile.png',
            })

          mockThumbnailService
            .createThumbnail
            .mockResolvedValue(
              Buffer.from('thumbnail')
            )

          mockThumbnailService
            .getThumbnailName
            .mockReturnValue(
              'thumbnailfile.png'
            )

          const savedBlueprint = {
            _id: 'blueprint id',
            blueprintName: dto.blueprintName,
          }

          saveMock.mockResolvedValue(
            savedBlueprint
          )

          const result =
            await service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE,
            )

          // membership
          expect(
            mockOrganizationMembershipService.findByUserIdAndOrganizationId,
          ).toHaveBeenCalledWith(
            test_user_id_string,
            dto.organizationId,
          )

          // uploads
          expect(
            mockStorageService.uploadFile,
          ).toHaveBeenCalledTimes(2)

          // thumbnail
          expect(
            mockThumbnailService.createThumbnail,
          ).toHaveBeenCalledTimes(1)

          // constructor
          expect(
            mockBlueprintModel
          ).toHaveBeenCalledTimes(1)

          // save
          expect(
            saveMock
          ).toHaveBeenCalledTimes(1)

          // activity logs
          expect(
            mockActivityLogService.create
          ).toHaveBeenCalledTimes(1)

          // result
          expect(
            result
          ).toMatchObject({
            blueprintName: dto.blueprintName,
          })

        }
      )

      it(
        'should fail creating blueprint because of invalid userId',
        async () => {

          const userId = 'invalid_id'

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          await expect (
            service.create(
              file,
              dto,
              userId,
              UserRole.NONE,
            )
          ).rejects.toThrow(ForbiddenException)
        }
      )

      it(
        'it should fail because of not sending file',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          await expect(
            service.create(
              undefined as any,
              dto,
              test_user_id_string,
              UserRole.NONE
            )
          ).rejects.toThrow(BadRequestException)
        }
      )

      it(
        'fails because of non existent organization',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue(
              undefined
            )

          await expect(
            service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE
            )
          ).rejects.toThrow(NotFoundException)

        }
      )

      it(
        'fails because of maximum uploads reached',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue({
              test_user_id_string,
              organizationId: dto.organizationId,
            })

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(10)

          await expect(
            service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE
            )
          ).rejects.toThrow(BadRequestException)
        }
      )

      it(
        'superadmin user can upload without belonging to organization',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue(null)

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(3)

          // uploadFile is being called 2 times
          mockStorageService
            .uploadFile
            .mockResolvedValueOnce({
              id: 'file id',
              name: 'storedfile.png',
            })
            .mockResolvedValueOnce({
              id: 'thumbnail id',
              name: 'thumbnailfile.png',
            })

          mockThumbnailService
            .createThumbnail
            .mockResolvedValue(
              Buffer.from('thumbnail')
            )

          mockThumbnailService
            .getThumbnailName
            .mockReturnValue(
              'thumbnailfile.png'
            )

          const savedBlueprint = {
            _id: 'blueprint id',
            blueprintName: dto.blueprintName,
          }

          saveMock.mockResolvedValue(
            savedBlueprint
          )

          const result =
            await service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.SUPERADMIN,
            )

          // membership
          expect(
            mockOrganizationMembershipService.findByUserIdAndOrganizationId,
          ).toHaveBeenCalledWith(
            test_user_id_string,
            dto.organizationId,
          )

          // uploads
          expect(
            mockStorageService.uploadFile,
          ).toHaveBeenCalledTimes(2)

          // thumbnail
          expect(
            mockThumbnailService.createThumbnail,
          ).toHaveBeenCalledTimes(1)

          // constructor
          expect(
            mockBlueprintModel
          ).toHaveBeenCalledTimes(1)

          // save
          expect(
            saveMock
          ).toHaveBeenCalledTimes(1)

          // activity logs
          expect(
            mockActivityLogService.create
          ).toHaveBeenCalledTimes(1)

          // result
          expect(
            result
          ).toMatchObject({
            blueprintName: dto.blueprintName,
          })

        }
      )

      it(
        'should fail because of uploadFile() fails',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue({
              test_user_id_string,
              organizationId: dto.organizationId,
            })

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(3)

          mockStorageService
            .uploadFile
            .mockRejectedValue(
              new Error('upload failed')
            )

          await expect (
            service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE,
            )
          ).rejects.toThrow()

          // membership
          expect(
            mockOrganizationMembershipService.findByUserIdAndOrganizationId,
          ).toHaveBeenCalledWith(
            test_user_id_string,
            dto.organizationId,
          )

          // uploads
          expect(
            mockStorageService.uploadFile,
          ).toHaveBeenCalledTimes(1)
        }
      )

      it(
        'fails because createThumbnail() fails',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue({
              test_user_id_string,
              organizationId: dto.organizationId,
            })

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(3)

          // uploadFile is being called 1 time
          mockStorageService
            .uploadFile
            .mockResolvedValueOnce({
              id: 'file id',
              name: 'storedfile.png',
            })

          mockThumbnailService
            .createThumbnail
            .mockRejectedValue(
              new Error('thumbnail failed')
            )

          await expect (
            service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE,
            )
          ).rejects.toThrow()

          expect(
            mockStorageService.deleteFile,
          ).toHaveBeenCalledTimes(1)
        }
      )

      it(
        'falis because save() fails',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c'
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue({
              test_user_id_string,
              organizationId: dto.organizationId,
            })

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(3)

          // uploadFile is being called 2 times
          mockStorageService
            .uploadFile
            .mockResolvedValueOnce({
              id: 'file id',
              name: 'storedfile.png',
            })
            .mockResolvedValueOnce({
              id: 'thumbnail id',
              name: 'thumbnailfile.png',
            })

          mockThumbnailService
            .createThumbnail
            .mockResolvedValue(
              Buffer.from('thumbnail')
            )

          mockThumbnailService
            .getThumbnailName
            .mockReturnValue(
              'thumbnailfile.png'
            )

          // fails save()
          saveMock.mockRejectedValue(
            new Error('save failed')
          )

          await expect(
            service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE,
            )
          ).rejects.toThrow()

          // rollback, deletes blueprint file and thumnail
          expect(
            mockStorageService.deleteFile,
          ).toHaveBeenCalledTimes(2)
        }
      )
      
      it(
        'fails because cant update originalBlueprint',
        async () => {

          const dto: CreateBlueprintDto = {
            blueprintName: 'test blueprint',
            projectId: '69c30bd8d16ceac57816ee7b',
            organizationId: '69c30bd8d16ceac57816ee7c',
            originalBlueprintId: '69c30bd8d16ceac57816ee7d',
          }

          const file = {
            originalname: 'test.png',
            buffer: Buffer.from('test'),
            mimetype: 'application/pdf',
            encoding: '7bit',
            size: 1000,
          } as Express.Multer.File

          mockOrganizationModel
            .findById
            .mockResolvedValue({
              _id: dto.organizationId,
              name: 'Test organization',
              maxBlueprints: 10,
            })

          // user belongs to organization
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue({
              test_user_id_string,
              organizationId: dto.organizationId,
            })

          // makes a mock of the funtion inside the service that is being called
          jest
            .spyOn(service, 'getBlueprintCountByOrganizationId',)
            .mockResolvedValue(3)

          // uploadFile is being called 2 times
          mockStorageService
            .uploadFile
            .mockResolvedValueOnce({
              id: 'file id',
              name: 'storedfile.png',
            })
            .mockResolvedValueOnce({
              id: 'thumbnail id',
              name: 'thumbnailfile.png',
            })

          mockThumbnailService
            .createThumbnail
            .mockResolvedValue(
              Buffer.from('thumbnail')
            )

          mockThumbnailService
            .getThumbnailName
            .mockReturnValue(
              'thumbnailfile.png'
            )

          const savedBlueprint = {
            _id: 'blueprint id',
            blueprintName: dto.blueprintName,
          }

          saveMock.mockResolvedValue(
            savedBlueprint
          )

          // fails here
          mockBlueprintModel.findByIdAndUpdate =
            jest.fn().mockRejectedValue(
              new Error('update fails')
            )

          await expect(
            service.create(
              file,
              dto,
              test_user_id_string,
              UserRole.NONE,
            )
          ).rejects.toThrow()

          expect(
            mockBlueprintModel.findByIdAndUpdate,
          ).toHaveBeenCalledTimes(1)
        }
      )

    })

    describe('findOne', () => {

      

    })

  })
