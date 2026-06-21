import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActionType } from '../common/types';

export type ActivityLogDocument = ActivityLog & Document;

@Schema({ _id: false })
class LogField {
  @Prop({ required: true, type: String })
  key: string;

  @Prop({ required: true, type: String })
  value: string;
}
const LogFieldSchema = SchemaFactory.createForClass(LogField);

@Schema()
export class ActivityLog {
    @Prop({ required: true, type: Date, default: Date.now, index: true })
    timestamp: Date;

    @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true})
    userId: Types.ObjectId;

    @Prop({ required: true, type: String, enum: ActionType, index: true})
    action: ActionType;

    @Prop({ type: String, default: ""})
    description: string;

    @Prop({ type: String })
    targetName: string;

    @Prop({ type: Types.ObjectId, index: true })
    targetId: Types.ObjectId;

    // 2. Usamos el esquema del subdocumento aquí
    @Prop({ type: [LogFieldSchema], default: [] })
    fields: LogField[];
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

ActivityLogSchema.index({
  targetId: 1,
  timestamp: -1,
});