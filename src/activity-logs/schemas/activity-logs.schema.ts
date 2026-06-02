import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActionType } from '../common/types';

export type ActivityLogDocument = ActivityLog & Document;

@Schema()
export class ActivityLog {

    @Prop({ required: true, type: Date, default: Date.now, index: true })
    timestamp: Date;

    @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true})
    userId: Types.ObjectId

    @Prop({ required: true, type: String, enum: ActionType, index: true})
    action: ActionType

    @Prop({ type: String, default: ""})
    description: string

    @Prop({ type: String })
    targetName: string

    @Prop({ type: Types.ObjectId, index: true })
    targetId: Types.ObjectId

}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog)

ActivityLogSchema.index({
  targetId: 1,
  timestamp: -1,
})