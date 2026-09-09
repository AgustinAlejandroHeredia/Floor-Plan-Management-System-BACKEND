import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('test', () => {
    it('reports the received bearer token', () => {
      expect(appController.test({ authorization: 'Bearer abc' })).toEqual({
        message: 'Request recibida',
        hasToken: true,
        authorization: 'Bearer abc',
      });
    });

    it('reports when no token is present', () => {
      const res = appController.test({});
      expect(res.hasToken).toBe(false);
      expect(res.authorization).toBeNull();
    });
  });
});
