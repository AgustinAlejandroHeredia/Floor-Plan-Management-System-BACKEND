import { IsMongoId, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

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
  tecnicalDirection: string;

  @IsString()
  state: string;

  @IsMongoId()
  creatorUserId: string;

  @IsMongoId()
  organizationId: string;

}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}