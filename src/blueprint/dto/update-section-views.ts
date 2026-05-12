import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CoordDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

class SizeDto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

export class SectionViewDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordDto)
  coordsList: CoordDto[];

  @ValidateNested()
  @Type(() => SizeDto)
  size: SizeDto;
}

export class UpdateSectionViewsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionViewDto)
  sectionViews: SectionViewDto[];
}