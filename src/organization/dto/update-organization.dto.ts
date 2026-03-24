import { IsMongoId, IsString, IsOptional } from 'class-validator';

export class UpdateOrganizationDto {

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  contact?: string;

  @IsString()
  @IsOptional()
  partida?: string;

}