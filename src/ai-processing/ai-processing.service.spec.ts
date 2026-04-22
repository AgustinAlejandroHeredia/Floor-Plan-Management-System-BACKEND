import { Test, TestingModule } from '@nestjs/testing';
import { AiProcessingService } from './ai-processing.service';

describe('AiProcessingService', () => {
  let service: AiProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiProcessingService],
    }).compile();

    service = module.get<AiProcessingService>(AiProcessingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
