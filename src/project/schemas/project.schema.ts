import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { OrganizationActionPermission } from 'src/common/orgPermission.enum';
import { ProjectStatus } from 'src/common/status.enum';

export type ProjectDocument = Project & Document;

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
        type: Map,
        of: SchemaTypes.Mixed,
        default: {},
    })
    customFields: Map<string, any>

}

export const ProjectSchema = SchemaFactory.createForClass(Project);