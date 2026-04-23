import { Transform, Type } from 'class-transformer';
import { IsString, Length, IsEmail, IsMongoId, IsNumber, IsInt, Min, Max, IsEnum } from 'class-validator';
import { MAX_BLUEPRINTS } from 'src/organization/common/maximumBlueprintsCount';
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';

export class CreateOrganizationDto {

  @IsString()
  @Transform(({ value }) => value?.trim())
  @Length(2, 100)
  name: string;

  @IsString()
  @Transform(({ value }) => value?.trim())
  @Length(5, 200)
  address: string;

  @IsEmail()
  @Transform(({ value }) => value?.trim())
  @Length(5, 100)
  contactEmail: string;

  @IsString()
  @Transform(({ value }) => value?.trim())
  @Length(6, 20)
  contactPhone: string;

  @IsString()
  @Transform(({ value }) => value?.trim())
  @Length(3, 50)
  record: string;

  @IsMongoId()
  adminId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BLUEPRINTS)
  maxBlueprints: number

  @IsEnum(OrganizationActionPermission)
  createPermission: OrganizationActionPermission

  @IsEnum(OrganizationActionPermission)
  invitePermission: OrganizationActionPermission

}