import { IsMongoId, IsNumber, IsString, IsOptional } from 'class-validator';

export class UpdateCropDto {

  @IsString()
  @IsOptional()
  filename?: string;

  @IsString()
  @IsOptional()
  storageId?: string;

  @IsString()
  @IsOptional()
  encoding?: string;

  @IsString()
  @IsOptional()
  mimetype?: string;

  @IsNumber()
  @IsOptional()
  size?: number;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  label?: string;

}