import { IsMongoId, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateInvitationDto {

  @IsMongoId()
  userID: string;

  @IsMongoId()
  organizationId: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsString()
  accessCode: string;

}