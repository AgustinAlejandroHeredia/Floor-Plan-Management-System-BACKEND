import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from 'src/common/role.enum';

export type UserDocument = User & Document;

@Schema()
export class User {

  @Prop({ required: true })
  authProviderId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  picture: string;

  @Prop({ 
    required: true,
    enum: UserRole,
    default: UserRole.NONE,
  })
  globalRole: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);