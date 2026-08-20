import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { InferenceJobService } from './inference-job.service';
import { InferenceDetectionService } from './inference-detection.service';
import { InferenceJob, InferenceJobStatus } from './schemas/inference-job.schema';
import { UserRole } from 'src/user/common/role.enum';
import { Blueprint } from 'src/blueprint/schemas/blueprint.schema';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { Types } from 'mongoose';
import { InferenceJobGateway } from './inference-job.gateway';
import { ConfigService } from '@nestjs/config';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

// jwks-rsa
jest.mock('jwks-rsa', () => jest.fn());

describe('InferenceJobService', () => {

    const userId = '69c30bd8d16ceac57816ee7a'
    const blueprintId = '69c30bd8d16ceac57816ee7b'
    const orgId = '69c30bd8d16ceac57816ee7c'
    const jobId = '69c30bd8d16ceac57816ee7d'

    let service: InferenceJobService

    let saveMock: jest.Mock

    // MODELS
    let mockInferenceJobModel: any
    let mockBlueprintModel: any

    // SERVICES
    let mockOrganizationMembershipService: any
    let mockActivityLogService: any
    let mockFileStorageService: any
    let mockConfigService: any
    let mockInferenceJobGateway: any
    let mockInferenceDetectionService: any

    beforeEach(async () => {

        jest.clearAllMocks()

        saveMock = jest.fn()

        mockInferenceJobModel =
            jest.fn().mockImplementation(
                (data) => ({
                    ...data,
                    save: saveMock
                })
            )
        mockInferenceJobModel.updateMany = jest.fn()
        mockInferenceJobModel.findById = jest.fn()
        mockInferenceJobModel.findOne = jest.fn()
        mockInferenceJobModel.findByIdAndUpdate = jest.fn()

        mockBlueprintModel = {
            findById: jest.fn(),
        }

        mockOrganizationMembershipService = {
            validateOrganizationAccess: jest.fn()
        }

        mockActivityLogService = {
            create: jest.fn()
        }

        mockFileStorageService = {}
        mockConfigService = { get: jest.fn() }
        mockInferenceJobGateway = { emit: jest.fn() }
        mockInferenceDetectionService = { detect: jest.fn() }

        const module =
            await Test.createTestingModule({
                providers: [
                    InferenceJobService,
                    {
                        provide: getModelToken(InferenceJob.name),
                        useValue: mockInferenceJobModel,
                    },
                    {
                        provide: getModelToken(Blueprint.name),
                        useValue: mockBlueprintModel,
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
                        provide: FileStorageService,
                        useValue: mockFileStorageService,
                    },
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: InferenceJobGateway,
                        useValue: mockInferenceJobGateway,
                    },
                    {
                        provide: InferenceDetectionService,
                        useValue: mockInferenceDetectionService,
                    },
                ],
            }).compile()

            service =
                module.get<InferenceJobService>(
                    InferenceJobService
                )
    })

    describe('enqueue', () => {

        it(
            'enqueue a new job successfully',
            async () => {

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            _id: blueprintId,
                            filename: 'testfile.png',
                            organizationId: new Types.ObjectId(orgId),
                            blueprintName: 'test blueprint',
                        })
                    })

                // membership
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockResolvedValue(undefined)

                // activity
                mockActivityLogService
                    .create
                    .mockResolvedValue(undefined)

                const savedJob = {
                    _id: new Types.ObjectId('69c30bd8d16ceac57816ee7d'),
                    id: '69c30bd8d16ceac57816ee7d',
                    blueprintId: new Types.ObjectId(blueprintId),
                    status: InferenceJobStatus.PENDING,
                    selectedModels: ['model'],
                    result: null,
                }

                saveMock.mockResolvedValue(savedJob)

                const result = await service.enqueue(
                    blueprintId,
                    ['model'],
                    userId,
                    UserRole.NONE,
                )

                expect(mockBlueprintModel.findById).toHaveBeenCalledWith(
                    blueprintId,
                    {
                        filename: 1,
                        organizationId: 1,
                        blueprintName: 1,
                    }
                )

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledWith(userId, orgId, UserRole.NONE)

                expect(saveMock).toHaveBeenCalledTimes(1)

                expect(mockActivityLogService.create).toHaveBeenCalledTimes(1)

                expect(result).toMatchObject({
                    status: InferenceJobStatus.PENDING,
                    selectedModels: ['model'],
                    result: null,
                })
            }
        )

        it(
            'falis because of blueprint not found',
            async () => {

                // blueprint not found
                mockBlueprintModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue(
                            null
                        )
                    })

                await expect (
                    service.enqueue(
                        blueprintId,
                        ['model'],
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(NotFoundException)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)
            }
        )

        it(
            'fails because of not valid access',
            async () => {

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            _id: blueprintId,
                            filename: 'testfile.png',
                            organizationId: new Types.ObjectId(orgId),
                            blueprintName: 'test blueprint',
                        })
                    })

                // membership
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockRejectedValue(
                        new ForbiddenException("Access denied, user does not belog to the organization")
                    )

                await expect(
                    service.enqueue(
                        blueprintId,
                        ['model'],
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(ForbiddenException)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)

                expect(saveMock).not.toHaveBeenCalled()
            }
        )

        it(
            'fails because no selected models (selectedModels.length === 0)',
            async () => {

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            _id: blueprintId,
                            filename: 'testfile.png',
                            organizationId: new Types.ObjectId(orgId),
                            blueprintName: 'test blueprint',
                        })
                    })

                // membership
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockResolvedValue(undefined)

                // no models selected -> empty list
                await expect(
                    service.enqueue(
                        blueprintId,
                        [], 
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(BadRequestException)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)

                expect(saveMock).not.toHaveBeenCalled()
            }
        )

        it(
            'fails because of save() fails',
            async () => {

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            _id: blueprintId,
                            filename: 'testfile.png',
                            organizationId: new Types.ObjectId(orgId),
                            blueprintName: 'test blueprint',
                        })
                    })

                // membership
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockResolvedValue(undefined)

                saveMock.mockRejectedValue(
                    new Error('save faliled')
                )

                await expect(
                    service.enqueue(
                        blueprintId,
                        ['model'], 
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow()

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)

                expect(
                    saveMock
                ).toHaveBeenCalledTimes(1)
            }
        )

    })

    describe('findOne', () => {

        it(
            'successfully findOne inference job',
            async () => {

                // inference job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            blueprintId: new Types.ObjectId(blueprintId),
                            status: InferenceJobStatus.PENDING,
                            selectedModels: ['model'],
                            result: null,
                        })
                    })

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockResolvedValue({
                        _id: blueprintId,
                        filename: 'testfile.png',
                        organizationId: new Types.ObjectId(orgId),
                        blueprintName: 'test blueprint',
                    })

                // user validated
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockResolvedValue(undefined)

                const result = await service.findOne(
                    jobId,
                    userId,
                    UserRole.NONE,
                )

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)

                expect(
                    result
                ).toMatchObject({
                    blueprintId: new Types.ObjectId(blueprintId),
                    status: InferenceJobStatus.PENDING,
                    selectedModels: ['model'],
                    result: null,
                })
            }
        )

        it(
            'fails because of inference job not found',
            async () => {

                // inference NOT job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue(
                            null
                        )
                    })
                
                await expect(
                    service.findOne(
                        jobId,
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(NotFoundException)

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(saveMock).not.toHaveBeenCalled()
            }
        )

        it(
            'fails because of blueprint not found',
            async () => {

                // inference job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            blueprintId: new Types.ObjectId(blueprintId),
                            status: InferenceJobStatus.PENDING,
                            selectedModels: ['model'],
                            result: null,
                        })
                    })

                // blueprint NOT found
                mockBlueprintModel
                    .findById
                    .mockResolvedValue(
                        null
                    )

                await expect(
                    service.findOne(
                        jobId,
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(NotFoundException)

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(saveMock).not.toHaveBeenCalled()
            }
        )

        it(
            'fails because of invalid user access',
            async () => {

                // inference job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            blueprintId: new Types.ObjectId(blueprintId),
                            status: InferenceJobStatus.PENDING,
                            selectedModels: ['model'],
                            result: null,
                        })
                    })

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockResolvedValue({
                        _id: blueprintId,
                        filename: 'testfile.png',
                        organizationId: new Types.ObjectId(orgId),
                        blueprintName: 'test blueprint',
                    })

                // user not valid
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockRejectedValue(
                        new ForbiddenException("Access denied, user does not belog to the organization")
                    )

                await expect(
                    service.findOne(
                        jobId,
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(ForbiddenException)

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)

                expect(saveMock).not.toHaveBeenCalled()
            }
        )

    })

    describe('cancel', () => {

        it(
            'successfully canceled inference job',
            async () => {

                // inference job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            blueprintId: new Types.ObjectId(blueprintId),
                            status: InferenceJobStatus.PENDING,
                            selectedModels: ['model'],
                            result: null,
                        })
                    })

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockResolvedValue({
                        _id: blueprintId,
                        filename: 'testfile.png',
                        organizationId: new Types.ObjectId(orgId),
                        blueprintName: 'test blueprint',
                    })

                // user validated
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockReturnValue(undefined)

                // find and update inference job
                mockInferenceJobModel
                    .findByIdAndUpdate
                    .mockReturnValue(undefined)

                // activity log created
                mockActivityLogService
                    .create
                    .mockReturnValue(undefined)

                await service.cancel(
                    jobId,
                    userId,
                    UserRole.NONE,
                )

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockActivityLogService.create
                ).toHaveBeenCalledTimes(1)
            }
        )

        it(
            'fails because inference job not found',
            async () => {

                // inference job NOT found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue(
                            null
                        )
                    })

                await expect (
                    service.cancel(
                        jobId,
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(NotFoundException)

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)
            }
        )

        it(
            'fails because blueprint not found',
            async () => {

                // inference job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            blueprintId: new Types.ObjectId(blueprintId),
                            status: InferenceJobStatus.PENDING,
                            selectedModels: ['model'],
                            result: null,
                        })
                    })

                // blueprint NOT found
                mockBlueprintModel
                    .findById
                    .mockResolvedValue(
                        null
                    )

                await expect (
                    service.cancel(
                        jobId,
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(NotFoundException)

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)
            }
        )

        it(
            'fails because invalid user access',
            async () => {

                // inference job found
                mockInferenceJobModel
                    .findById
                    .mockReturnValue({
                        lean: jest.fn().mockResolvedValue({
                            blueprintId: new Types.ObjectId(blueprintId),
                            status: InferenceJobStatus.PENDING,
                            selectedModels: ['model'],
                            result: null,
                        })
                    })

                // blueprint found
                mockBlueprintModel
                    .findById
                    .mockResolvedValue({
                        _id: blueprintId,
                        filename: 'testfile.png',
                        organizationId: new Types.ObjectId(orgId),
                        blueprintName: 'test blueprint',
                    })

                // invalid user
                mockOrganizationMembershipService
                    .validateOrganizationAccess
                    .mockRejectedValue(
                        new ForbiddenException("Access denied, user does not belog to the organization")
                    )

                await expect (
                    service.cancel(
                        jobId,
                        userId,
                        UserRole.NONE,
                    )
                ).rejects.toThrow(ForbiddenException)

                expect(
                    mockInferenceJobModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockBlueprintModel.findById
                ).toHaveBeenCalledTimes(1)

                expect(
                    mockOrganizationMembershipService.validateOrganizationAccess
                ).toHaveBeenCalledTimes(1)
            }
        )

    })

})