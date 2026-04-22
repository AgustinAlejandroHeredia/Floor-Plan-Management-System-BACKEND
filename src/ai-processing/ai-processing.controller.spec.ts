import { Test, TestingModule } from '@nestjs/testing';
import { AiProcessingController } from './ai-processing.controller';
import { AiProcessingService } from './ai-processing.service';

describe('AiProcessingController', () => {
  let controller: AiProcessingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiProcessingController],
      providers: [AiProcessingService],
    }).compile();

    controller = module.get<AiProcessingController>(AiProcessingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
