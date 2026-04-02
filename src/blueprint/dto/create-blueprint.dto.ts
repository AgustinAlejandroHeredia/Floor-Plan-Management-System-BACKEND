import { IsArray, IsMongoId, IsNumber, IsString } from 'class-validator';

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

}