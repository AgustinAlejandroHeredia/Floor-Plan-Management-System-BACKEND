import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from 'src/user/common/role.enum';

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
    type: String,
    enum: UserRole,
    default: UserRole.NONE,
  })
  globalRole: UserRole;

  @Prop({
    type: Date,
    default: Date.now
  })
  joinedAt: Date
}

export const UserSchema = SchemaFactory.createForClass(User);