import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlueprintDocument = Blueprint & Document;

@Schema()
export class Blueprint {

    @Prop({ required: true, type: String })
    blueprintName: string

    @Prop({ required: true, type: String })
    filename: string

    @Prop({ required: true, type: Types.ObjectId, ref: 'Project', index: true })
    projectId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: 'Organization'})
    organizationId: Types.ObjectId

    @Prop({ required: true, type: String })
    storageId: string

    @Prop({ required: true, type: String })
    encoding: string

    @Prop({ required: true, type: String })
    mimetype: string

    @Prop({ required: true, type: Number })
    size: number

    @Prop({ required: true, type: Date, default: Date.now, index: true})
    creationDate: Date

    @Prop({ required: true, type: [String] })
    tags: string[]

    @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
    uploadedBy: Types.ObjectId

}

export const BlueprintSchema = SchemaFactory.createForClass(Blueprint);