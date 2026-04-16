import { Type } from 'class-transformer';
import { IsString, IsOptional, Length, IsEmail, IsInt, Max, Min, IsEnum } from 'class-validator';
import { MAX_BLUEPRINTS } from 'src/common/maximumBlueprintsCount';
import { OrganizationActionPermission } from 'src/common/orgPermission.enum';

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

  @IsOptional()
  @IsEnum(OrganizationActionPermission)
  createPermission?: OrganizationActionPermission

  @IsOptional()
  @IsEnum(OrganizationActionPermission)
  invitePermission?: OrganizationActionPermission

}

export class UpdateOrganizationActionPermissionsDto {

  @IsOptional()
  @IsEnum(OrganizationActionPermission)
  createPermission?: OrganizationActionPermission

  @IsOptional()
  @IsEnum(OrganizationActionPermission)
  invitePermission?: OrganizationActionPermission

}