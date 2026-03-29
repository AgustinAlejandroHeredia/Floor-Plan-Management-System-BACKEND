import { IsMongoId, IsNumber, IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateBlueprintDto {

  @IsString()
  @IsOptional()
  filename?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

}