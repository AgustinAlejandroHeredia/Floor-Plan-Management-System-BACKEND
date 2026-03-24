import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema()
export class Project {

    @Prop({ required: true, type: String })
    projectName: string

    @Prop({ required: true, type: String })
    record: string

    @Prop({ required: true, type: String })
    address: string

    @Prop({ required: true, type: String })
    scale: string

    @Prop({ required: true, type: String })
    others: string

    @Prop({ required: true, type: String })
    references: string

    @Prop({ required: true, type: String })
    background: string

    @Prop({ required: true, type: String })
    owner: string

    @Prop({ required: true, type: String })
    tecnicalDirection: string

    @Prop({ required: true, type: String })
    state: string

    @Prop({ required: true, type: Types.ObjectId })
    creatorUserId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId })
    organizationId: Types.ObjectId

}

export const ProjectSchema = SchemaFactory.createForClass(Project);