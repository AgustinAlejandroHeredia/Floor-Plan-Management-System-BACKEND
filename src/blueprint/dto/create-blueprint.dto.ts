import { IsArray, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBlueprintDto {

  @IsString()
  blueprintName: string;

  @IsMongoId()
  projectId: string;

  @IsMongoId()
  organizationId: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[]

  @IsOptional()
  @IsMongoId()
  originalBlueprintId?: string 

  @IsOptional()
  @IsNumber()
  width?: number
  
  @IsOptional()
  @IsNumber()
  height?: number

}