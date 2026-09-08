import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { OrganizationActionPermission } from 'src/organization/common/orgPermission.enum';
import { ProjectStatus } from 'src/project/common/status.enum';
import { CustomFieldType } from '../common/types';

export type ProjectDocument = Project & Document;

@Schema({ _id: false })
export class CustomField {
    @Prop({ required: true, type: String })
    name: string;

    @Prop({ required: true, type: String, enum: Object.values(CustomFieldType) })
    type: CustomFieldType;

    @Prop({ required: true, type: SchemaTypes.Mixed })
    value: string | number | Date
}

export const CustomFieldSchema = SchemaFactory.createForClass(CustomField);

@Schema()
export class Project {

    // PROJECT NAME CAN BE REPEATED
    @Prop({ required: true, type: String, trim: true, maxlength: 100 })
    projectName: string

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

    @Prop({ 
        required: true,
        type: String,
        default: "1",
    })
    levels: string

    @Prop({
        required: true,
        type: Boolean,
        default: false,
    })
    basement: boolean


    @Prop({
        type: [CustomFieldSchema],
        default: [],
    })
    customFields: CustomField[]

}

export const ProjectSchema = SchemaFactory.createForClass(Project);