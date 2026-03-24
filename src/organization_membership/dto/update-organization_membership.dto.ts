import { IsMongoId } from 'class-validator';

export class UpdateOrganizationMembershipDto {

  @IsMongoId()
  userId?: string;

  @IsMongoId()
  organizationId?: string;

}