import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload for saving a user-adjusted or fully-manual alignment from the UI.
 * Provide the 2x3 `matrix` (this blueprint's pixels -> `alignedWith`'s pixels);
 * scale/rotation/translation are optional derived values for display.
 */
export class SaveAlignmentDto {
  @ApiProperty({ description: 'Id of the counterpart blueprint this is aligned to' })
  @IsMongoId()
  alignedWith: string;

  @ApiProperty({
    description: '2x3 affine matrix mapping this blueprint px -> counterpart px',
    example: [
      [1, 0, 0],
      [0, 1, 0],
    ],
  })
  @IsArray()
  matrix: number[][];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  scale?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rotationDeg?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  translation?: number[];

  @ApiPropertyOptional({ description: 'confidence/overlap score, if known' })
  @IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
