import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CropDocument = Crop & Document;

@Schema()
export class Crop {

    @Prop({ required: true, type: String })
    filename: string

    @Prop({ required: true, type: String })
    storageId: string

    @Prop({ required: true, type: String })
    encoding: string

    @Prop({ required: true, type: String })
    mimetype: string

    @Prop({ required: true, type: Number })
    size: number

    @Prop({ required: true, type: Date, default: Date.now })
    creationDate: Date

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    croppedBy: Types.ObjectId

    // diferences from blueprint.schema.ts

    @Prop({ required: true, type: String })
    specialty: string

    @Prop({ required: true, type: String })
    label: string

    @Prop({ required: true, type: Types.ObjectId, ref: 'Blueprint' }) // id from the original bluepint
    cropFrom: Types.ObjectId
}

export const CropSchema = SchemaFactory.createForClass(Crop);