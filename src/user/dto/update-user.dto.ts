import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UpdateUserDto {

  @IsString()
  authProviderId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  picture?: string;

}