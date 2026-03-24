import { IsString, IsEmail } from 'class-validator';

export class CreateUserDto {

  @IsString()
  authProviderId: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  picture: string;

}