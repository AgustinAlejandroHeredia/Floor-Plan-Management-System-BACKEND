import { IsMongoId, IsObject, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

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