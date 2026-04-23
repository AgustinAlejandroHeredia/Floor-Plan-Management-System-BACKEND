import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsObject, IsBoolean } from 'class-validator';
import { ProjectStatus } from 'src/project/common/status.enum';

export class UpdateProjectDto {

  @IsString()
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  projectName?: string
  
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus

  @IsOptional()
  @IsString()
  levels?: string

  @IsOptional()
  @IsBoolean()
  basement?: boolean

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>

}