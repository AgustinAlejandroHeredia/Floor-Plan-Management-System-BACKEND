import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InferenceJobDocument = HydratedDocument<InferenceJob>;

export enum InferenceJobStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  PROCESSED = 'Processed',
  ERROR = 'Error',
  CANCELLED = 'Cancelled',
}

@Schema({ timestamps: true })
export class InferenceJob {
  @Prop({ type: Types.ObjectId, ref: 'Blueprint', required: true, index: true })
  blueprintId: Types.ObjectId;

  @Prop({
    type: String,
    enum: InferenceJobStatus,
    default: InferenceJobStatus.PENDING,
    required: true,
  })
  status: InferenceJobStatus;

  @Prop({ type: Object, default: null })
  result: Record<string, any> | null;
}

export const InferenceJobSchema = SchemaFactory.createForClass(InferenceJob);
