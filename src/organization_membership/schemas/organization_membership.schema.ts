import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationMembershipDocument = OrganizationMembership & Document;

@Schema()
export class OrganizationMembership {

    @Prop({ required: true, type: Types.ObjectId })
    userId: Types.ObjectId

    @Prop({ required: true, type: Types.ObjectId })
    organizationId: Types.ObjectId

}

export const OrganizationMembershipSchema = SchemaFactory.createForClass(OrganizationMembership);