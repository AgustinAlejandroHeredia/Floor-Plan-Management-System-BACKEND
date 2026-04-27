import { Transform } from 'class-transformer';
import { IsMongoId, IsNumber, IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { OrganizationRole } from 'src/user/common/role.enum';

export class CreateInvitationDto {

  @IsMongoId()
  organizationId: string

  @IsString()
  @IsEmail()
  @Transform(({ value }) => value?.trim())
  userEmail: string

  @IsOptional()
  @IsNumber()
  duration?: number

  @IsOptional()
  @IsEnum(OrganizationRole)
  userOrganizationRole: OrganizationRole

}