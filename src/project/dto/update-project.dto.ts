import { IsMongoId, IsString, IsOptional } from 'class-validator';

export class UpdateProjectDto {

  @IsMongoId()
  creatorUserId?: string;

  @IsMongoId()
  organizationId?: string;

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsString()
  @IsOptional()
  record?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  scale?: string;

  @IsString()
  @IsOptional()
  others?: string;

  @IsString()
  @IsOptional()
  references?: string;

  @IsString()
  @IsOptional()
  background?: string;

  @IsString()
  @IsOptional()
  owner?: string;

  @IsString()
  @IsOptional()
  tecnicalDirection?: string;

  @IsString()
  @IsOptional()
  state?: string;

}