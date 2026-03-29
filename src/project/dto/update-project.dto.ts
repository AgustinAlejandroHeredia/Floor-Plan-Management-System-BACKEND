import { IsMongoId, IsString, IsOptional, IsEnum } from 'class-validator';
import { ProjectStatus } from 'src/common/status.enum';

export class UpdateProjectDto {

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
  
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsMongoId()
  creatorUserId?: string;

  @IsMongoId()
  organizationId?: string;

}