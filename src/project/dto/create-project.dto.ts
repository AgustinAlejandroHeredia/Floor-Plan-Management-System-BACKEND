import { IsEnum, IsMongoId, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ProjectStatus } from 'src/common/status.enum';

export class CreateProjectDto {

  @IsString()
  projectName: string;

  @IsString()
  record: string;

  @IsString()
  address: string;

  @IsString()
  scale: string;

  @IsString()
  others: string;

  @IsString()
  references: string;

  @IsString()
  background: string;

  @IsString()
  owner: string;

  @IsString()
  technicalDirection: string;

  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @IsMongoId()
  creatorUserId: string;

  @IsMongoId()
  organizationId: string;

}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}