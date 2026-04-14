import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MAX_BLUEPRINTS } from 'src/common/maximumBlueprintsCount';

export type OrganizationDocument = Organization & Document;

@Schema()
export class Organization {

    @Prop({ required: true, trim: true, maxlength: 100 })
    name: string;

    @Prop({ required: true, trim: true, maxlength: 200 })
    address: string;

    @Prop({ 
        required: true, 
        trim: true, 
        lowercase: true,
        maxlength: 100,
        unique: true,
    })
    contactEmail: string;

    @Prop({ 
        required: true, 
        trim: true,
        maxlength: 20,
        unique: true,
    })
    contactPhone: string;

    @Prop({ 
        required: true, 
        trim: true,
        maxlength: 50,
    })
    record: string;

    @Prop({
        required: true,
        default: 50,
        min: 1,
        max: MAX_BLUEPRINTS,
    })
    maxBlueprints: number;

}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

// NO DUPLICATED ORGANIZATION NAMES
OrganizationSchema.index({ name: 1 }, { unique: true });