import { Test } from '@nestjs/testing';
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
import { Types } from 'mongoose';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import axios from 'axios';
import { spawn } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

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

    mockBlueprintModel.findById = jest.fn()
    mockBlueprintModel.findByIdAndUpdate = jest.fn()
    mockBlueprintModel.findByIdAndDelete = jest.fn()

    mockOrganizationMembershipService = {
      findByUserIdAndOrganizationId: jest.fn(),
      validateOrganizationAccess: jest.fn(),
    }

    mockStorageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
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

    mockProjectModel = {
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


    describe('detectScaleForBlueprint', () => {

      it('should update the blueprint scale using AI detection', async () => {
        const blueprintId = '69c30bd8d16ceac57816ee7d';
        const blueprint = {
          _id: blueprintId,
          filename: 'blueprint.png',
          organizationId: '69c30bd8d16ceac57816ee7c',
        };

        mockBlueprintModel.findById
          .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(blueprint) })
          .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ ...blueprint, scale: 0.123, scale_source: 'ai' }) });

        mockBlueprintModel.findByIdAndUpdate.mockResolvedValue({
          ...blueprint,
          scale: 0.123,
          scale_source: 'ai',
        });

        mockStorageService.getSignedDownloadUrl.mockResolvedValue('https://example.com/blueprint.png');

        jest.spyOn(axios, 'get').mockResolvedValue({
          data: Readable.from([Buffer.from('fake-image')]),
          headers: { 'content-type': 'image/png' },
        } as any);

        const child = new EventEmitter() as any;
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        (spawn as jest.Mock).mockReturnValue(child);

        const result = await service.detectScaleForBlueprint(
          blueprintId,
          test_user_id_string,
          UserRole.NONE,
        );

        child.stdout.emit('data', Buffer.from('<scale_orientation>{"scale":0.123,"orientation":0.0}</scale_orientation>'));
        child.stdout.emit('end');
        child.stderr.emit('end');
        child.emit('close', 0);

        expect(result.scale).toBe(0.123);
        expect(result.scale_source).toBe('ai');
        expect(mockBlueprintModel.findByIdAndUpdate).toHaveBeenCalledWith(
          expect.anything(),
          { scale: 0.123, scale_source: 'ai' },
        );
      });
    });

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

      it('finds one blueprint successfully', async () => {

        const blueprintId = '69c30bd8d16ceac57816ee7z'
        const orgId = '69c30bd8d16ceac57816ee7a'

        // blueprint FOUND
        mockBlueprintModel.findById.mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: blueprintId,
            blueprintName: 'Test blueprint',
            filename: 'file.png',
            projectId: new Types.ObjectId(),
            organizationId: new Types.ObjectId(orgId),
            originalBlueprintId: null,
          }),
        })

        // membership
        mockOrganizationMembershipService
          .findByUserIdAndOrganizationId
          .mockResolvedValue(true)

        // download url
        mockStorageService
          .getSignedDownloadUrl
          .mockResolvedValue('downloadUrl')

        // project
        mockProjectModel
          .findById
          .mockResolvedValue({
            levels: 8,
            basement: true,
          })

        const result = await service.findOne(
          blueprintId,
          test_user_id_string,
          UserRole.NONE,
        )

        // assertions
        expect(mockBlueprintModel.findById).toHaveBeenCalledWith(
          blueprintId,
          { titleBlock: 0 },
        )

        expect(
          mockOrganizationMembershipService.findByUserIdAndOrganizationId,
        ).toHaveBeenCalledWith(
          test_user_id_string,
          orgId,
        )

        expect(
          mockStorageService.getSignedDownloadUrl,
        ).toHaveBeenCalledWith('file.png')

        expect(mockProjectModel.findById).toHaveBeenCalled()

        expect(result).toHaveProperty('downloadUrl', 'downloadUrl')
      })

      it(
        'fails because cant find the blueprint',
        async () => {

          const blueprintId = '69c30bd8d16ceac57816ee7z'

          // blueprint FOUND
          mockBlueprintModel.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null)
          })

          await expect (
            service.findOne(
              blueprintId,
              test_user_id_string,
              UserRole.NONE,
            )
          ).rejects.toThrow(NotFoundException)

          expect(mockBlueprintModel.findById).toHaveBeenCalled()
        }
      )

      it(
        'fails because user does not belong to the organization',
        async () => {

          const blueprintId = '69c30bd8d16ceac57816ee7z'
          const orgId = '69c30bd8d16ceac57816ee7a'

          // blueprint FOUND
          mockBlueprintModel.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: blueprintId,
              blueprintName: 'Test blueprint',
              filename: 'file.png',
              projectId: new Types.ObjectId(),
              organizationId: new Types.ObjectId(orgId),
              originalBlueprintId: null,
            }),
          })

          // membership
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue(false)

          await expect (
              service.findOne(
                blueprintId,
                test_user_id_string,
                UserRole.NONE,
              )
            ).rejects.toThrow(ForbiddenException)

          expect(mockBlueprintModel.findById).toHaveBeenCalled()

          expect(
            mockOrganizationMembershipService.findByUserIdAndOrganizationId,
          ).toHaveBeenCalledTimes(1)
        }
      )

      it(
        'successfully gets blueprint with superadmin role without being member',
        async () => {

          const blueprintId = '69c30bd8d16ceac57816ee7z'
          const orgId = '69c30bd8d16ceac57816ee7a'

          // blueprint FOUND
          mockBlueprintModel.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: blueprintId,
              blueprintName: 'Test blueprint',
              filename: 'file.png',
              projectId: new Types.ObjectId(),
              organizationId: new Types.ObjectId(orgId),
              originalBlueprintId: null,
            }),
          })

          // membership
          mockOrganizationMembershipService
            .findByUserIdAndOrganizationId
            .mockResolvedValue(false)

          // download url
          mockStorageService
            .getSignedDownloadUrl
            .mockResolvedValue('downloadUrl')

          // project
          mockProjectModel
            .findById
            .mockResolvedValue({
              levels: 8,
              basement: true,
            })

          const result = await service.findOne(
            blueprintId,
            test_user_id_string,
            UserRole.SUPERADMIN,
          )

          // assertions
          expect(mockBlueprintModel.findById).toHaveBeenCalledWith(
            blueprintId,
            { titleBlock: 0 },
          )

          expect(
            mockOrganizationMembershipService.findByUserIdAndOrganizationId,
          ).toHaveBeenCalledWith(
            test_user_id_string,
            orgId,
          )

          expect(
            mockStorageService.getSignedDownloadUrl,
          ).toHaveBeenCalledWith('file.png')

          expect(mockProjectModel.findById).toHaveBeenCalled()

          expect(result).toHaveProperty('downloadUrl', 'downloadUrl')

        }
      )

    })
    
    describe('remove', () => {

      it(
        'successfully deletes blueprint and files',
        async () => {

          const blueprintId = '69c30bd8d16ceac57816ee7z'

          const orgId = '69c30bd8d16ceac57816ee7a'

          // blueprint FOUND
          mockBlueprintModel.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: blueprintId,
              blueprintName: 'Test blueprint',
              filename: 'file.png',
              storageId: 'storage-id-123',
              storageThumbnailId: 'thumbnail-id-123',
              projectId: new Types.ObjectId(),
              organizationId: new Types.ObjectId(orgId),
              originalBlueprintId: null,
            }),
          })

          // belongs to organization
          mockOrganizationMembershipService
            .validateOrganizationAccess
            .mockResolvedValue(undefined)

          // not a crop, so no update

          // delete mongo doc
          mockBlueprintModel
            .findByIdAndDelete
            .mockResolvedValue(undefined)

          // delete files
          mockStorageService
            .deleteFile
            .mockResolvedValue(undefined)

          // activity log
          mockActivityLogService
            .create
            .mockResolvedValue(undefined)

          const result = await service.remove(
            blueprintId,
            test_user_id_string,
            UserRole.NONE
          )

          // result
          expect(
            result
          ).toMatchObject({
            message: 'Blueprint eliminado correctamente',
          })

          expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(2)
          expect(mockBlueprintModel.findByIdAndDelete).toHaveBeenCalledWith(blueprintId)
        }
      )

      it(
        'fails because cant find the blueprint', 
        async () => {

          const blueprintId = '69c30bd8d16ceac57816ee7z'

          // blueprint NOT FOUND
          mockBlueprintModel.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue(undefined),
          })

          await expect (
              service.remove(
                blueprintId,
                test_user_id_string,
                UserRole.NONE,
              )
            ).rejects.toThrow(NotFoundException)

          expect(mockBlueprintModel.findById).toHaveBeenCalledTimes(1)
        }
      )

      it(
        'fails because of invalid access',
        async () => {

          const blueprintId = '69c30bd8d16ceac57816ee7z'

          const orgId = '69c30bd8d16ceac57816ee7a'

          // blueprint FOUND
          mockBlueprintModel.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: blueprintId,
              blueprintName: 'Test blueprint',
              filename: 'file.png',
              storageId: 'storage-id-123',
              storageThumbnailId: 'thumbnail-id-123',
              projectId: new Types.ObjectId(),
              organizationId: new Types.ObjectId(orgId),
              originalBlueprintId: null,
            }),
          })

          // belongs to organization
          mockOrganizationMembershipService
            .validateOrganizationAccess
            .mockRejectedValue(new ForbiddenException("Access denied, user does not belog to the organization"))

          await expect (
              service.remove(
                blueprintId,
                test_user_id_string,
                UserRole.NONE,
              )
            ).rejects.toThrow(ForbiddenException)

          expect(mockBlueprintModel.findByIdAndDelete).not.toHaveBeenCalled()
          expect(mockStorageService.deleteFile).not.toHaveBeenCalled()
        }
      )

    })

  })
