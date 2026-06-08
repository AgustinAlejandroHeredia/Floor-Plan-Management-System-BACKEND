import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'

import { ActivityLogsService } from './activity-logs.service'
import { ActivityLog } from './schemas/activity-logs.schema'
import { describe } from 'node:test'
import { CreateActivityLogDto } from './dto/create-activity-log.dto'
import { ActionType } from './common/types'
import { Types } from 'mongoose'

// TEST USER ID = 69c30bd8d16ceac57816ee7a

describe('ActivityLogsService', () => {

  const test_user_id_string = '69c30bd8d16ceac57816ee7a'

  let service: ActivityLogsService

  let saveMock: jest.Mock
  let findMock: jest.Mock
  let findByIdAndDeleteMock: jest.Mock

  let mockActivityLogModel: any

  beforeEach(async () => {

    jest.clearAllMocks()

    saveMock = jest.fn()

    findMock = jest.fn()

    findByIdAndDeleteMock = jest.fn()

    mockActivityLogModel =
      jest.fn().mockImplementation(
        (data) => ({
          ...data,
          save: saveMock,
        }),
      )

    mockActivityLogModel.find =
      findMock

    mockActivityLogModel.findByIdAndDelete =
      findByIdAndDeleteMock

    const module =
      await Test.createTestingModule({
        providers: [
          ActivityLogsService,
          {
            provide: getModelToken(
              ActivityLog.name,
            ),
            useValue:
              mockActivityLogModel,
          },
        ],
      }).compile();

    service =
      module.get<ActivityLogsService>(
        ActivityLogsService,
      )
  })

  describe('getUserActivityLogs', () => {
    
    it(
      'should create a new activity log successfully',
      async () => {

        const dto: CreateActivityLogDto = {
          action: ActionType.TEST_ACTION,
          description: 'Test action',
          targetName: 'Test user',
          targetId: test_user_id_string,
        }

        const savedLog = {
          _id: '123',
          action: ActionType.TEST_ACTION,
          description: 'Test action',
          targetName: 'Test user',
          targetId: test_user_id_string,
          userId: test_user_id_string,
        }

        // when mongo executes save, this is returned (savedLog)
        const saveMock =
          jest.fn().mockResolvedValue(
            savedLog,
          )

        // mocks the "new this.activityLogModel(...)" from the service
        const modelConstructorMock =
          jest.fn().mockImplementation(
            (data) => ({
              ...data,
              save: saveMock,
            }),
          );

        (
          service as any
        ).activityLogModel =
          modelConstructorMock

        const result =
          await service.create(
            test_user_id_string,
            dto,
          )

        // did it try to construct a mock 1 time?
        expect(
          modelConstructorMock,
        ).toHaveBeenCalledTimes(1)

        // did it try to construct a mock with the right data?
        expect(
          modelConstructorMock,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            action:
              ActionType.TEST_ACTION,

            description:
              'Test action',

            targetName:
              'Test user',

            targetId:
              test_user_id_string,

            userId:
              expect.any(
                Types.ObjectId,
              ),
          }),
        )

        // did it call to save()?
        expect(saveMock)
          .toHaveBeenCalledTimes(1)

        // did it returned what it should return?
        expect(result)
          .toMatchObject({
            action: ActionType.TEST_ACTION,
            description: 'Test action',
            targetName: 'Test user',
            targetId: test_user_id_string,
            userId: test_user_id_string,
          })
      },
    )

    it(
      'should fail creating activity log because of invalid userId',
      async () => {
        const userId = 'invalid_id'

        const dto: CreateActivityLogDto = {
          action: ActionType.TEST_ACTION,
          description: 'Test action',
          targetName: 'Test user',
          targetId: userId,
        };

        const result =
          await service.create(
            userId,
            dto,
          );

        expect(result)
          .toBeUndefined();
      }
    )

    it(
      'should return user activity logs ordered by timestamp desc',
      async () => {

        const userId = test_user_id_string

        const logs = [
          {
            action: ActionType.TEST_ACTION,
          },
        ]

        const execMock =
          jest.fn().mockResolvedValue(
            logs,
          )

        const sortMock =
          jest.fn().mockReturnValue({
            exec: execMock,
          })

        mockActivityLogModel.find
          .mockReturnValue({
            sort: sortMock,
          })

        const result =
          await service.getUserActivityLogs(
            userId,
          )

        expect(
          mockActivityLogModel.find,
        ).toHaveBeenCalledWith({
          userId:
            expect.any(
              Types.ObjectId,
            ),
        })

        expect(sortMock)
          .toHaveBeenCalledWith({
            timestamp: -1,
          })

        expect(execMock)
          .toHaveBeenCalled()

        expect(result)
          .toEqual(logs)
      },
    )

    it(
      'should delete activity log',
      async () => {

        const activityId =
          '69c30bd8d16ceac57816ee7a';

        const deletedLog = {
          _id: activityId,
          action:
            ActionType.TEST_ACTION,
        }

        findByIdAndDeleteMock
          .mockResolvedValue(
            deletedLog,
          )

        const result =
          await service.deleteActivityLog(
            activityId,
          )

        expect(
          mockActivityLogModel
            .findByIdAndDelete,
        ).toHaveBeenCalledWith(
          expect.any(
            Types.ObjectId,
          ),
        )

        expect(result)
          .toEqual(
            deletedLog,
          )
      },
    )

  })

})