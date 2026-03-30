import { IsString, Length, IsEmail } from 'class-validator';

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

}