import { IsString, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from 'src/user/common/role.enum';

export class CreateUserDto {

  @IsString()
  authProviderId: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  picture: string;

  @IsEnum(UserRole)
  globalRole: UserRole
  
}