import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import type { OrganizationStatus } from '@servora/types';

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ _id: false })
export class OrganizationContact {
  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({ type: String, trim: true, lowercase: true })
  email?: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ type: [Number] })
  coordinates?: [number, number];
}

@Schema({ _id: false })
export class OrganizationBranding {
  @Prop({ type: String, trim: true })
  logoUrl?: string;

  @Prop({ type: String, trim: true, default: '#2563eb' })
  primaryColor?: string;

  @Prop({ type: String, trim: true })
  coverImageUrl?: string;
}

@Schema({ _id: false })
export class OrganizationSettings {
  @Prop({ type: Number, default: 15, min: 0 })
  bookingBufferMinutes!: number;

  @Prop({ type: Number, default: 30, min: 1 })
  maxAdvanceBookingDays!: number;

  @Prop({ type: Boolean, default: true })
  autoConfirmBookings!: boolean;
}

@Schema({
  timestamps: true,
  collection: 'organizations',
})
export class Organization extends Document {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  })
  slug!: string;

  @Prop({
    type: String,
    default: 'Asia/Kolkata',
    required: true,
    trim: true,
  })
  timezone!: string;

  @Prop({
    type: String,
    default: 'INR',
    required: true,
    trim: true,
    uppercase: true,
  })
  currency!: string;

  @Prop({ type: OrganizationContact, default: () => ({}) })
  contact!: OrganizationContact;

  @Prop({ type: OrganizationBranding, default: () => ({}) })
  branding!: OrganizationBranding;

  @Prop({ type: OrganizationSettings, default: () => ({}) })
  settings!: OrganizationSettings;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'PENDING_ONBOARDING'],
    default: 'ACTIVE',
    required: true,
    index: true,
  })
  status!: OrganizationStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
