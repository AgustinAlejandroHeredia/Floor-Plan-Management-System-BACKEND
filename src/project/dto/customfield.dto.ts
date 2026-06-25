import { IsString, IsEnum, IsNotEmpty } from "class-validator";
import { CustomFieldType } from "../common/types";

export class CustomFieldDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @IsNotEmpty()
  value: any;
}