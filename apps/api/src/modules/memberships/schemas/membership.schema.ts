import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import type { MembershipRole, MembershipStatus } from '@servora/types';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({
  timestamps: true,
  collection: 'memberships',
})
export class Membership extends Document {
  /**
   * Reference to the Organization (tenant anchor).
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  })
  organizationId!: Types.ObjectId;

  /**
   * Reference to the User identity.
   * NOT globally unique; a single user may have memberships across multiple organizations.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  /**
   * Role within this specific organization tenant.
   */
  @Prop({
    type: String,
    enum: ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'STAFF'],
    required: true,
  })
  role!: MembershipRole;

  /**
   * Membership status within this tenant.
   */
  @Prop({
    type: String,
    enum: ['INVITED', 'ACTIVE', 'REVOKED'],
    default: 'ACTIVE',
    required: true,
  })
  status!: MembershipStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// Compound Unique Index: prevents a user from having duplicate memberships in the same organization
MembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

// Secondary Index: lookup all organizations for a given user
MembershipSchema.index({ userId: 1 });

// Secondary Index: query active members of an organization
MembershipSchema.index({ organizationId: 1, status: 1 });
