import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  
  @IsOptional()
  @IsString()
  folder?: string; // ej: "users/avatars"

  @IsOptional()
  @IsString()
  fileName?: string; // nombre custom (si no usás originalname)

  @IsOptional()
  @IsString()
  description?: string; // metadata opcional

  @IsOptional()
  @IsString()
  userId?: string; // útil si querés asociarlo a un usuario

}