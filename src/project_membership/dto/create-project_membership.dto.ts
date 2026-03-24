import { IsEnum, IsMongoId } from 'class-validator';
import { Role } from 'src/common/role.enum';

export class CreateProjectMembershipDto {

  @IsMongoId()
  userId: string;

  @IsMongoId()
  organizationId: string;

  @IsEnum(Role)
  role: Role;

}