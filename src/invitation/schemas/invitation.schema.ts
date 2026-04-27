import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrganizationRole } from 'src/user/common/role.enum';

export type InvitationDocument = Invitation & Document;

@Schema()
export class Invitation {

    @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
    organizationId: Types.ObjectId

    @Prop({ required: true })
    userEmail: string

    @Prop({ required: true })
    sentByUserId: Types.ObjectId

    @Prop({ required: true, type: Date, default: Date.now })
    creationDate: Date

    @Prop({ required: true, type: Number , default: 24 }) // hours
    duration: number

    @Prop({ 
        required: true,
        type: String,
        enum: OrganizationRole,
        default: OrganizationRole.MEMBER,
    })
    userOrganizationRole: OrganizationRole

    @Prop({ 
        required: true, 
        type: String,
        unique: true,
        index: true,
    })
    accessCode: string

}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);