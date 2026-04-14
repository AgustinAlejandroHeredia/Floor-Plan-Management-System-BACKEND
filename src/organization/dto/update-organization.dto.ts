import { Type } from 'class-transformer';
import { IsString, IsOptional, Length, IsEmail, IsInt, Max, Min } from 'class-validator';
import { MAX_BLUEPRINTS } from 'src/common/maximumBlueprintsCount';

export class UpdateOrganizationDto {

  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(5, 200)
  address?: string;

  @IsOptional()
  @IsEmail()
  @Length(5, 100)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  record?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BLUEPRINTS)
  maxBlueprints?: number

}