import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { ActionType } from '../common/types';

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

}