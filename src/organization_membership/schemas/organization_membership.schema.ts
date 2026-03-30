import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrganizationRole } from 'src/common/role.enum';

export type OrganizationMembershipDocument = OrganizationMembership & Document;

@Schema()
export class OrganizationMembership {

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    userId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
    organizationId: Types.ObjectId

    @Prop({ 
        required: true,
        type: String,
        enum: OrganizationRole,
        default: OrganizationRole.MEMBER,
    })
    organizationRole: OrganizationRole

}

export const OrganizationMembershipSchema = SchemaFactory.createForClass(OrganizationMembership);

// NO DUPLICATES
OrganizationMembershipSchema.index(
  { userId: 1, organizationId: 1 },
  { unique: true }
);

// OPTIONAL INDEXES
OrganizationMembershipSchema.index({ userId: 1 });
OrganizationMembershipSchema.index({ projectId: 1 });