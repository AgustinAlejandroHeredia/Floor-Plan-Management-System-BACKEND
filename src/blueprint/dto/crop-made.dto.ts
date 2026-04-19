import { IsMongoId, IsString } from "class-validator";

export class CropMadeDto {

  @IsMongoId()
  blueprintId: string;

  @IsString()
  blueprintName: string;

}