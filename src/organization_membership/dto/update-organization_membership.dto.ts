import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { OrganizationRole } from 'src/common/role.enum';

export class UpdateOrganizationMembershipDto {

  @IsOptional()
  @IsEnum(OrganizationRole)
  organizationRole?: OrganizationRole;

}