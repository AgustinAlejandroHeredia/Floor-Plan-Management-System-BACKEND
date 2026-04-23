import { IsBoolean, IsMongoId, IsObject, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';

export class CreateProjectDto {

  @IsString()
  @Transform(({ value }) => value?.trim())
  projectName: string

  @IsMongoId()
  organizationId: string

  @IsString()
  levels: string

  @IsBoolean()
  basement: boolean

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>

}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}