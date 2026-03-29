import { IsArray, IsMongoId, IsNumber, IsString } from 'class-validator';

export class CreateBlueprintDto {

  @IsString()
  filename: string;

  @IsMongoId()
  projectId: string;

  @IsMongoId()
  organizationId: string;

  @IsString()
  storageId: string;

  @IsString()
  encoding: string;

  @IsString()
  mimetype: string;

  @IsNumber()
  size: number;

  @IsArray()
  @IsString({ each: true })
  tags: string[]

  @IsString()
  uploadedBy: string;

}