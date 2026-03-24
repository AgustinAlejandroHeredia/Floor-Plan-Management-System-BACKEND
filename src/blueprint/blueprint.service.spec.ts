import { Test, TestingModule } from '@nestjs/testing';
import { BlueprintService } from './blueprint.service';

describe('BlueprintService', () => {
  let service: BlueprintService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlueprintService],
    }).compile();

    service = module.get<BlueprintService>(BlueprintService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
