import { Test, TestingModule } from '@nestjs/testing';
import { ProjectMembershipController } from './project_membership.controller';
import { ProjectMembershipService } from './project_membership.service';

describe('ProjectMembershipController', () => {
  let controller: ProjectMembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectMembershipController],
      providers: [ProjectMembershipService],
    }).compile();

    controller = module.get<ProjectMembershipController>(ProjectMembershipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
