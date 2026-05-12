import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  SpecialtyTag,
  BlueprintLabel,
  BlueprintView,
} from '../common/blueprintLabel';

export type BlueprintDocument = Blueprint & Document;

@Schema({ _id: false })
export class Coord {
  @Prop({ required: true, type: Number })
  x: number;

  @Prop({ required: true, type: Number })
  y: number;
}

@Schema({ _id: false })
export class SectionSize {
  @Prop({ required: true, type: Number })
  width: number;

  @Prop({ required: true, type: Number })
  height: number;
}

@Schema({ _id: false })
export class SectionView {
  @Prop({ required: true, type: String })
  type: string;

  @Prop({ required: false, type: String })
  label?: string;

  @Prop({ required: false, type: Number })
  confidence?: number;

  @Prop({
    type: [Coord],
    default: [],
  })
  coordsList: Coord[];

  @Prop({
    type: SectionSize,
    required: true,
  })
  size: SectionSize;
}

@Schema({ _id: false })
export class CropMade {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Blueprint' })
  blueprintId: Types.ObjectId;

  @Prop({ required: true, type: String })
  blueprintName: string;
}

@Schema()
export class Blueprint {
  @Prop({ required: true, type: String })
  blueprintName: string;

  @Prop({ required: true, type: String })
  filename: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Project', index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
  organizationId: Types.ObjectId;

  @Prop({ required: true, type: String })
  storageId: string;

  @Prop({ required: true, type: String })
  storageThumbnailId: string;

  @Prop({ required: true, type: String })
  encoding: string;

  @Prop({ required: true, type: String })
  mimetype: string;

  @Prop({ required: true, type: Number })
  size: number;

  @Prop({ required: true, type: Date, default: Date.now, index: true })
  creationDate: Date;

  // MARKED AREAS BY AI
  @Prop({
    type: [SectionView],
    default: [],
  })
  sectionViews: SectionView[];

  @Prop({
    type: [String],
    enum: SpecialtyTag,
    default: [],
  })
  specialties: SpecialtyTag[];

  @Prop({
    type: [String],
    default: [],
  })
  levels: string[];

  @Prop({
    type: String,
    enum: BlueprintView,
    required: false,
    default: BlueprintView.UNDEFINED,
  })
  view?: BlueprintView;

  @Prop({
    type: [String],
    default: [],
  })
  titleBlock: string[];

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  uploadedBy: Types.ObjectId;

  @Prop({ required: false, type: Types.ObjectId, ref: 'Blueprint' })
  originalBlueprintId?: Types.ObjectId;

  @Prop({ required: false, type: Number })
  width?: number;

  @Prop({ required: false, type: Number })
  height?: number;

  @Prop({
    type: [CropMade],
    default: [],
  })
  cropsMade: CropMade[];
}

export const BlueprintSchema = SchemaFactory.createForClass(Blueprint);