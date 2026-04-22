import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { ProjectRole } from 'src/user/common/role.enum';

export class UpdateProjectMembershipDto {

  @IsOptional()
  @IsEnum(ProjectRole)
  projectRole?: ProjectRole;

}