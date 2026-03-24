import { IsMongoId } from 'class-validator';

export class CreateOrganizationMembershipDto {

  @IsMongoId()
  userId: string;

  @IsMongoId()
  organizationId: string;

}