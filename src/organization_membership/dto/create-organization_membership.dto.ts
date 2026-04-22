import { IsEnum, IsMongoId } from 'class-validator';
import { OrganizationRole } from 'src/user/common/role.enum';

export class CreateOrganizationMembershipDto {

  @IsMongoId()
  userId: string;

  @IsMongoId()
  organizationId: string;

  @IsEnum(OrganizationRole)
  organizationRole: OrganizationRole;

}