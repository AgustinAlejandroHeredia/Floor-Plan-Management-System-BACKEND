import { Test, TestingModule } from '@nestjs/testing';
import { CropController } from './crop.controller';
import { CropService } from './crop.service';

describe('CropController', () => {
  let controller: CropController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CropController],
      providers: [CropService],
    }).compile();

    controller = module.get<CropController>(CropController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
