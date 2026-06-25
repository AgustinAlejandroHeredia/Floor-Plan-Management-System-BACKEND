import { IsArray, IsBoolean, IsMongoId, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { CustomFieldDto } from './customfield.dto';

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDto)
  customFields?: CustomFieldDto[]

}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}