import { Test, TestingModule } from '@nestjs/testing';
import { ProjectMembershipService } from './project_membership.service';

describe('ProjectMembershipService', () => {
  let service: ProjectMembershipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectMembershipService],
    }).compile();

    service = module.get<ProjectMembershipService>(ProjectMembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
