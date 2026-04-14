import { Type } from 'class-transformer';
import { IsString, Length, IsEmail, IsMongoId, IsNumber, IsInt, Min, Max } from 'class-validator';
import { MAX_BLUEPRINTS } from 'src/common/maximumBlueprintsCount';

export class CreateOrganizationDto {

  @IsString()
  @Length(2, 100)
  name: string;

  @IsString()
  @Length(5, 200)
  address: string;

  @IsEmail()
  @Length(5, 100)
  contactEmail: string;

  @IsString()
  @Length(6, 20)
  contactPhone: string;

  @IsString()
  @Length(3, 50)
  record: string;

  @IsMongoId()
  adminId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BLUEPRINTS)
  maxBlueprints: number

}