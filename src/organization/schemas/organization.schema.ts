import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema()
export class Organization {

    @Prop({ required: true, type: String })
    name: string

    @Prop({ required: true, type: String })
    address: string

    @Prop({ required: true, type: String })
    contact: string

    @Prop({ required: true, type: String })
    partida: string

}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);