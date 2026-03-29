import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectStatus } from 'src/common/status.enum';

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
    technicalDirection: string

    @Prop({ 
        required: true, 
        type: String, 
        enum: ProjectStatus, 
        default: ProjectStatus.PENDING 
    })
    status: ProjectStatus

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    creatorUserId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
    organizationId: Types.ObjectId

}

export const ProjectSchema = SchemaFactory.createForClass(Project);