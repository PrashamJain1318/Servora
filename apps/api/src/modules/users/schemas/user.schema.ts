import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import type { GlobalRole } from '@servora/types';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User extends Document {
  /**
   * External authentication provider ID (e.g. Clerk user ID).
   * Sparse & unique so local or pending users without external ID can exist without conflict.
   */
  @Prop({
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  })
  externalAuthId?: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    type: String,
    trim: true,
  })
  firstName?: string;

  @Prop({
    type: String,
    trim: true,
  })
  lastName?: string;

  @Prop({
    type: String,
    trim: true,
  })
  phone?: string;

  @Prop({
    type: String,
    trim: true,
  })
  avatarUrl?: string;

  @Prop({
    type: String,
    enum: ['PLATFORM_ADMIN', 'USER'],
    default: 'USER',
    required: true,
  })
  globalRole!: GlobalRole;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive?: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
