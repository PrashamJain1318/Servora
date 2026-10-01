import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type ProcessedWebhookEventDocument = HydratedDocument<ProcessedWebhookEvent>;

@Schema({
  collection: 'processed_webhook_events',
  timestamps: { createdAt: true, updatedAt: false },
})
export class ProcessedWebhookEvent extends Document {
  /**
   * Unique event identifier provided by the webhook service (e.g. svix-id).
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  eventId!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  eventType!: string;

  @Prop({
    type: String,
    required: true,
    default: 'CLERK',
    trim: true,
  })
  provider!: string;

  @Prop({
    type: Date,
    default: Date.now,
    required: true,
  })
  processedAt!: Date;

  /**
   * Created timestamp with 24-hour (86400 seconds) TTL index for automated replay deduplication cleanup.
   */
  @Prop({
    type: Date,
    default: Date.now,
    expires: 86400,
  })
  createdAt!: Date;
}

export const ProcessedWebhookEventSchema = SchemaFactory.createForClass(ProcessedWebhookEvent);
