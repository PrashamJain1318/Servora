import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Webhook } from 'svix';
import type { ClerkWebhookEvent } from '@servora/types';
import { User } from '../users/schemas/user.schema';
import { ProcessedWebhookEvent } from './schemas/processed-webhook-event.schema';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(ProcessedWebhookEvent.name)
    private readonly processedEventModel: Model<ProcessedWebhookEvent>,
  ) {}

  /**
   * Cryptographically verifies the Svix signature on incoming Clerk webhook payloads.
   */
  verifyClerkWebhook(
    payload: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): ClerkWebhookEvent {
    const webhookSecret = process.env['CLERK_WEBHOOK_SECRET'];

    if (!webhookSecret) {
      this.logger.error('CLERK_WEBHOOK_SECRET is not configured in the environment.');
      throw new BadRequestException('Webhook verification misconfigured on server.');
    }

    const svixId = (headers['svix-id'] || headers['Svix-Id']) as string | undefined;
    const svixTimestamp = (headers['svix-timestamp'] || headers['Svix-Timestamp']) as
      string | undefined;
    const svixSignature = (headers['svix-signature'] || headers['Svix-Signature']) as
      string | undefined;

    if (!svixId || !svixTimestamp || !svixSignature) {
      this.logger.warn('Missing required Svix headers on incoming webhook.');
      throw new BadRequestException('Missing required Svix headers');
    }

    const payloadString = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;

    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(payloadString, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });

      return JSON.parse(payloadString) as ClerkWebhookEvent;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Checks whether the event has already been processed to guarantee idempotency.
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const exists = await this.processedEventModel.exists({ eventId });
    return Boolean(exists);
  }

  /**
   * Records that an event has been processed.
   */
  async recordEventProcessed(eventId: string, eventType: string): Promise<void> {
    try {
      await this.processedEventModel.create({
        eventId,
        eventType,
        provider: 'CLERK',
        processedAt: new Date(),
      });
    } catch (err: any) {
      // E11000 duplicate key error indicates concurrent duplicate delivery
      if (err.code === 11000) {
        this.logger.debug(`Duplicate event ID ${eventId} recorded concurrently.`);
        return;
      }
      throw err;
    }
  }

  /**
   * Processes a verified Clerk webhook event idempotently.
   */
  async processClerkWebhook(
    payload: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean; eventType?: string }> {
    const event = this.verifyClerkWebhook(payload, headers);
    const eventId = (headers['svix-id'] || headers['Svix-Id']) as string;

    // Deduplication check
    const alreadyProcessed = await this.isEventProcessed(eventId);
    if (alreadyProcessed) {
      this.logger.log(`[Idempotency] Duplicate webhook event ${eventId} (${event.type}) ignored.`);
      return { received: true, duplicate: true, eventType: event.type };
    }

    // Process event based on lifecycle type
    switch (event.type) {
      case 'user.created':
        await this.handleUserCreated(event.data);
        break;

      case 'user.updated':
        await this.handleUserUpdated(event.data);
        break;

      case 'user.deleted':
        await this.handleUserDeleted(event.data);
        break;

      default:
        this.logger.log(`Unhandled Clerk event type: ${event.type}. Acknowledged safely.`);
        break;
    }

    // Mark event as processed
    await this.recordEventProcessed(eventId, event.type);

    return { received: true, eventType: event.type };
  }

  /**
   * Handles user.created event by performing an idempotent upsert into the Servora User collection.
   */
  private async handleUserCreated(data: any): Promise<void> {
    const externalAuthId = data.id;
    const email = data.email_addresses?.[0]?.email_address;

    if (!externalAuthId || !email) {
      this.logger.warn('user.created event missing externalAuthId or email.');
      return;
    }

    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    const phone = data.phone_numbers?.[0]?.phone_number || '';
    const avatarUrl = data.image_url || '';

    await this.userModel.findOneAndUpdate(
      { externalAuthId },
      {
        $set: {
          externalAuthId,
          email: email.toLowerCase().trim(),
          firstName,
          lastName,
          phone,
          avatarUrl,
          isActive: true,
        },
        $setOnInsert: {
          globalRole: 'USER',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    this.logger.log(`Synchronized user.created for Clerk ID: ${externalAuthId}`);
  }

  /**
   * Handles user.updated event by idempotently updating identity-provider-owned fields only.
   */
  private async handleUserUpdated(data: any): Promise<void> {
    const externalAuthId = data.id;
    if (!externalAuthId) {
      this.logger.warn('user.updated event missing externalAuthId.');
      return;
    }

    const email = data.email_addresses?.[0]?.email_address;
    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    const phone = data.phone_numbers?.[0]?.phone_number || '';
    const avatarUrl = data.image_url || '';

    const updateFields: Record<string, any> = {
      firstName,
      lastName,
      phone,
      avatarUrl,
    };

    if (email) {
      updateFields['email'] = email.toLowerCase().trim();
    }

    await this.userModel.findOneAndUpdate(
      { externalAuthId },
      { $set: updateFields },
      { new: true },
    );

    this.logger.log(`Synchronized user.updated for Clerk ID: ${externalAuthId}`);
  }

  /**
   * Handles user.deleted event by soft-deactivating the user, preserving data retention
   * and ensuring memberships and tenant data are not destroyed.
   */
  private async handleUserDeleted(data: any): Promise<void> {
    const externalAuthId = data.id;
    if (!externalAuthId) {
      this.logger.warn('user.deleted event missing externalAuthId.');
      return;
    }

    await this.userModel.findOneAndUpdate({ externalAuthId }, { $set: { isActive: false } });

    this.logger.log(`Soft-deactivated user.deleted for Clerk ID: ${externalAuthId}`);
  }
}
