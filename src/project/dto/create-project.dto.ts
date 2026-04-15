import { IsEnum, IsMongoId, IsObject, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ProjectStatus } from 'src/common/status.enum';

export class CreateProjectDto {

  @IsString()
  projectName: string

  @IsMongoId()
  organizationId: string

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>

}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}