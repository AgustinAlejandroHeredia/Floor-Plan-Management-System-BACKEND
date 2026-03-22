import { IsString, IsEmail } from 'class-validator';

export class CreateUserDto {

    @IsString()
    id: string // auth0 --> sub

    @IsEmail()
    email: string

    @IsString()
    name: string

    @IsString()
    picture: string

}
