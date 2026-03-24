import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationMembershipController } from './organization_membership.controller';
import { OrganizationMembershipService } from './organization_membership.service';

describe('OrganizationMembershipController', () => {
  let controller: OrganizationMembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationMembershipController],
      providers: [OrganizationMembershipService],
    }).compile();

    controller = module.get<OrganizationMembershipController>(OrganizationMembershipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
