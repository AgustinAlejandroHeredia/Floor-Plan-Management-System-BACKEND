import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvitationDocument = Invitation & Document;

@Schema()
export class Invitation {

    @Prop({ required: true, type: Types.ObjectId })
    userId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId })
    organizationId: Types.ObjectId

    @Prop({ required: true, type: Date, default: Date.now })
    creationDate: Date

    @Prop({ required: true, type: Number , default: 24 }) // 24 hours
    duration: number

    @Prop({ required: true, type: String })
    accessCode: string

}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);