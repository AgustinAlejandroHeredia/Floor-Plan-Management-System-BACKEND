import { Transform, Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsObject, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { ProjectStatus } from 'src/project/common/status.enum';
import { CustomFieldDto } from './customfield.dto';

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDto)
  customFields?: CustomFieldDto[]

}