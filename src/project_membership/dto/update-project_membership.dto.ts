import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { ProjectRole } from 'src/common/role.enum';

export class UpdateProjectMembershipDto {

  @IsOptional()
  @IsEnum(ProjectRole)
  projectRole?: ProjectRole;

}