import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { ActionType } from '../common/types';
import { Type } from 'class-transformer';

class LogFieldDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateActivityLogDto {

  @IsEnum(ActionType)
  action!: ActionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetName?: string;

  @IsOptional()
  @IsMongoId()
  targetId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LogFieldDto)
  fields?: LogFieldDto[];

}