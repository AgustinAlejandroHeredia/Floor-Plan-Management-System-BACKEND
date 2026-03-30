import { IsString, IsOptional, Length, IsEmail } from 'class-validator';

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

}