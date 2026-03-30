import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectStatus } from 'src/common/status.enum';

export type ProjectDocument = Project & Document;

@Schema()
export class Project {

    // PROJECT NAME CAN BE REPEATED
    @Prop({ required: true, type: String, trim: true, maxlength: 100 })
    projectName: string

    @Prop({ required: true, type: String, trim: true, maxlength: 50 })
    record: string

    @Prop({ required: true, type: String, trim: true, maxlength: 200 })
    address: string

    @Prop({ required: true, type: String, trim: true, maxlength: 50 })
    scale: string

    @Prop({ required: true, type: String, trim: true })
    others: string

    @Prop({ required: true, type: String, trim: true })
    references: string

    @Prop({ required: true, type: String, trim: true })
    background: string

    @Prop({ required: true, type: String, trim: true, maxlength: 100 })
    owner: string

    @Prop({ required: true, type: String, trim: true, maxlength: 100 })
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