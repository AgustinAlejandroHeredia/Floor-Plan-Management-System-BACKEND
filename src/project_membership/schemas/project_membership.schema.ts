import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectRole } from 'src/common/role.enum';

export type ProjectMembershipDocument = ProjectMembership & Document;

@Schema()
export class ProjectMembership {

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    userId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
    projectId: Types.ObjectId

    @Prop({ 
        required: true,
        type: String,
        enum: ProjectRole,
        default: ProjectRole.VIEWER,
    }) 
    projectRole: ProjectRole

}

export const ProjectMembershipSchema = SchemaFactory.createForClass(ProjectMembership);

// NO DUPLICATES
ProjectMembershipSchema.index(
  { userId: 1, projectId: 1 },
  { unique: true }
);

// OPTIONAL INDEXES
ProjectMembershipSchema.index({ userId: 1 });
ProjectMembershipSchema.index({ projectId: 1 });