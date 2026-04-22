import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { CropMadeDto } from './crop-made.dto';
import { SpecialtyTag, BlueprintLabel, BlueprintView } from '../common/blueprintLabel';
import { SectionViewDto } from './create-blueprint.dto';

export class UpdateBlueprintDto {

  @IsString()
  @IsOptional()
  blueprintName?: string;

  // NEW TAGS
  @IsOptional()
  @IsArray()
  @IsEnum(SpecialtyTag, { each: true })
  specialties?: SpecialtyTag[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levels?: string[];

  @IsOptional()
  @IsEnum(BlueprintView)
  view?: BlueprintView;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionViewDto)
  sectionViews?: SectionViewDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  titleBlock?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CropMadeDto)
  cropsMade?: CropMadeDto[];

}