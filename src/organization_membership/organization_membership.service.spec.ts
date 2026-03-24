import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationMembershipService } from './organization_membership.service';

describe('OrganizationMembershipService', () => {
  let service: OrganizationMembershipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationMembershipService],
    }).compile();

    service = module.get<OrganizationMembershipService>(OrganizationMembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
