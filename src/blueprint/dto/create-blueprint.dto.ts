import { IsArray, IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SpecialtyTag, BlueprintView } from '../common/blueprintLabel';
import { Transform, Type } from 'class-transformer';

export class LevelsRangeDto {
  @IsOptional()
  @IsBoolean()
  basement?: boolean

  @IsOptional()
  @IsBoolean()
  roof?: boolean

  @IsOptional()
  @IsNumber()
  bottom?: number;

  @IsOptional()
  @IsNumber()
  top?: number;
}

export class SectionViewDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

export class CreateBlueprintDto {

  @IsString()
  @Transform(({ value }) => value?.trim())
  blueprintName: string;

  @IsMongoId()
  projectId: string;

  @IsMongoId()
  organizationId: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SpecialtyTag, { each: true })
  specialties?: SpecialtyTag[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LevelsRangeDto)
  levels?: LevelsRangeDto[];

  @IsOptional()
  @IsEnum(BlueprintView)
  view?: BlueprintView;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionViewDto)
  sectionViews?: SectionViewDto[];

  @IsOptional()
  @IsMongoId()
  originalBlueprintId?: string;

  @IsOptional()
  @IsNumber()
  width?: number;
  
  @IsOptional()
  @IsNumber()
  height?: number;
}