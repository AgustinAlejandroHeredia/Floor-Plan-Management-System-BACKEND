import { IsMongoId, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ProjectStatus } from 'src/common/status.enum';

export class UpdateProjectDto {

  @IsString()
  @IsOptional()
  projectName?: string
  
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>

}