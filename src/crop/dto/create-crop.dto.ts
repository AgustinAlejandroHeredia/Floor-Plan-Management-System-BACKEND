import { IsMongoId, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateCropDto {

  @IsString()
  filename: string;

  @IsString()
  storageId: string;

  @IsString()
  encoding: string;

  @IsString()
  mimetype: string;

  @IsNumber()
  size: number;

  @IsMongoId()
  croppedBy: string;

  @IsString()
  specialty: string;

  @IsString()
  label: string;

  @IsMongoId()
  cropFrom: string;

}