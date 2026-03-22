import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {

  @Prop({ required: true })
  auth0Id: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  picture: string;

  @Prop({ required: true, default: false })
  admin: boolean;

  @Prop({ required: true, default: false })
  creator: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);