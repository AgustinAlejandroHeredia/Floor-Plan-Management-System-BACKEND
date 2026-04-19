import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { CropMadeDto } from './crop-made.dto';

export class UpdateBlueprintDto {

  @IsString()
  @IsOptional()
  blueprintName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CropMadeDto)
  cropsMade?: CropMadeDto[];

}