import { IsEnum, IsMongoId } from 'class-validator';
import { ProjectRole } from 'src/common/role.enum';

export class CreateProjectMembershipDto {

  @IsMongoId()
  userId: string;

  @IsMongoId()
  projectId: string;

  @IsEnum(ProjectRole)
  projectRole: ProjectRole;

}