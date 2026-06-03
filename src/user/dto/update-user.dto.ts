import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UpdateUserDto {

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