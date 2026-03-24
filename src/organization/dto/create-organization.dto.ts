import { IsMongoId, IsString } from 'class-validator';

export class CreateOrganizationDto {

  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  contact: string;

  @IsMongoId()
  forma: string;

}