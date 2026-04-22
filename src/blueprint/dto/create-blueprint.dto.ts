import { IsArray, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SpecialtyTag, BlueprintLabel, BlueprintView } from '../common/blueprintLabel';
import { Type } from 'class-transformer';

export class SectionViewDto {
  @IsString()
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
  blueprintName: string;

  @IsMongoId()
  projectId: string;

  @IsMongoId()
  organizationId: string;

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
  @IsMongoId()
  originalBlueprintId?: string 

  @IsOptional()
  @IsNumber()
  width?: number
  
  @IsOptional()
  @IsNumber()
  height?: number

}