import { IsEnum, IsMongoId } from 'class-validator';
import { OrganizationRole } from 'src/common/role.enum';

export class UpdateProjectMembershipDto {

  @IsMongoId()
  userId?: string;

  @IsMongoId()
  organizationId?: string;

  @IsEnum(OrganizationRole)
  projectRole?: OrganizationRole;

}