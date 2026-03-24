import { Test, TestingModule } from '@nestjs/testing';
import { BlueprintController } from './blueprint.controller';
import { BlueprintService } from './blueprint.service';

describe('BlueprintController', () => {
  let controller: BlueprintController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlueprintController],
      providers: [BlueprintService],
    }).compile();

    controller = module.get<BlueprintController>(BlueprintController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
