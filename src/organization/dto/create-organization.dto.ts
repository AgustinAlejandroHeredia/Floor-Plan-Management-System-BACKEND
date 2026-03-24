import { IsString } from 'class-validator';

export class CreateOrganizationDto {

  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  contact: string;

  @IsString()
  partida: string;

}