import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/common/role.enum';

export type ProjectMembershipDocument = ProjectMembership & Document;

@Schema()
export class ProjectMembership {

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    userId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
    projectId: Types.ObjectId

    @Prop({ 
        required: true, 
        type: Number,
        default: 1,
        enum: Role, // project role: 1 common 2 creator 3 admin 4 super admin
    }) 
    role: number

}

export const ProjectMembershipSchema = SchemaFactory.createForClass(ProjectMembership);