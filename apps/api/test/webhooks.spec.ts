import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { Webhook } from 'svix';
import { User, UserSchema } from '../src/modules/users/schemas/user.schema';
import {
  ProcessedWebhookEvent,
  ProcessedWebhookEventSchema,
} from '../src/modules/webhooks/schemas/processed-webhook-event.schema';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';

describe('Clerk Webhook Ingestion & User Synchronization (Categories E, F, G, H, I)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let userModel: Model<User>;
  let processedEventModel: Model<ProcessedWebhookEvent>;
  let webhooksService: WebhooksService;

  const TEST_SECRET = 'whsec_MfKQ9r8GKYdaOpWYoQqhgZffqwWBNE7O';
  const svix = new Webhook(TEST_SECRET);

  beforeAll(async () => {
    process.env['CLERK_WEBHOOK_SECRET'] = TEST_SECRET;

    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();

    userModel = connection.model(User.name, UserSchema);
    processedEventModel = connection.model(ProcessedWebhookEvent.name, ProcessedWebhookEventSchema);

    await userModel.syncIndexes();
    await processedEventModel.syncIndexes();

    webhooksService = new WebhooksService(userModel, processedEventModel);
  });

  afterAll(async () => {
    delete process.env['CLERK_WEBHOOK_SECRET'];
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await processedEventModel.deleteMany({});
  });

  // Helper to generate signed Svix headers
  const signPayload = (payloadString: string, msgId = `evt_${Date.now()}_${Math.random()}`) => {
    const timestamp = new Date();
    const signature = svix.sign(msgId, timestamp, payloadString);
    const headers = {
      'svix-id': msgId,
      'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
      'svix-signature': signature,
    };
    return { msgId, headers };
  };

  // --- Category H: Webhook Signature Verification ---
  describe('Category H: Webhook Signature Verification', () => {
    it('should successfully verify a properly signed Svix payload', () => {
      const payload = JSON.stringify({
        object: 'event',
        type: 'user.created',
        data: { id: 'user_123' },
      });
      const { headers } = signPayload(payload);

      const verified = webhooksService.verifyClerkWebhook(payload, headers);
      expect(verified.type).toBe('user.created');
      expect((verified.data as any).id).toBe('user_123');
    });

    it('should reject requests with missing Svix headers with 400 Bad Request', () => {
      const payload = JSON.stringify({ type: 'user.created' });
      expect(() => webhooksService.verifyClerkWebhook(payload, {})).toThrow(BadRequestException);
    });

    it('should reject requests with forged or invalid Svix signatures with 400 Bad Request', () => {
      const payload = JSON.stringify({ type: 'user.created' });
      const headers = {
        'svix-id': 'fake_id',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,invalidSignatureString==',
      };

      expect(() => webhooksService.verifyClerkWebhook(payload, headers)).toThrow(
        BadRequestException,
      );
      expect(() => webhooksService.verifyClerkWebhook(payload, headers)).toThrow(
        'Invalid webhook signature',
      );
    });
  });

  // --- Category E: User Synchronization (user.created) ---
  describe('Category E: User Created Webhook Flow', () => {
    it('should idempotently create a Servora User from a verified user.created event', async () => {
      const payload = JSON.stringify({
        object: 'event',
        type: 'user.created',
        data: {
          id: 'clerk_user_rohit_456',
          email_addresses: [{ email_address: 'rohit@detailing.in' }],
          first_name: 'Rohit',
          last_name: 'Verma',
          phone_numbers: [{ phone_number: '+919876543210' }],
          image_url: 'https://img.clerk.com/rohit.png',
        },
      });
      const { headers } = signPayload(payload);

      const result = await webhooksService.processClerkWebhook(payload, headers);
      expect(result.received).toBe(true);
      expect(result.eventType).toBe('user.created');

      // Verify User persisted in MongoDB
      const user = await userModel.findOne({ externalAuthId: 'clerk_user_rohit_456' });
      expect(user).toBeDefined();
      expect(user?.email).toBe('rohit@detailing.in');
      expect(user?.firstName).toBe('Rohit');
      expect(user?.lastName).toBe('Verma');
      expect(user?.phone).toBe('+919876543210');
      expect(user?.avatarUrl).toBe('https://img.clerk.com/rohit.png');
      expect(user?.globalRole).toBe('USER');
      expect(user?.isActive).toBe(true);
    });
  });

  // --- Category F: User Updated Webhook ---
  describe('Category F: User Updated Webhook Flow', () => {
    it('should idempotently update identity fields while preserving platform fields', async () => {
      // Pre-existing user with custom globalRole
      await userModel.create({
        email: 'original@servora.app',
        firstName: 'Original',
        externalAuthId: 'clerk_user_update_789',
        globalRole: 'PLATFORM_ADMIN',
        isActive: true,
      });

      const updatePayload = JSON.stringify({
        object: 'event',
        type: 'user.updated',
        data: {
          id: 'clerk_user_update_789',
          email_addresses: [{ email_address: 'updated@servora.app' }],
          first_name: 'UpdatedName',
          last_name: 'LastName',
          phone_numbers: [{ phone_number: '+919999888877' }],
          image_url: 'https://img.clerk.com/updated.png',
        },
      });
      const { headers } = signPayload(updatePayload);

      const result = await webhooksService.processClerkWebhook(updatePayload, headers);
      expect(result.received).toBe(true);

      const user = await userModel.findOne({ externalAuthId: 'clerk_user_update_789' });
      expect(user?.email).toBe('updated@servora.app');
      expect(user?.firstName).toBe('UpdatedName');
      expect(user?.phone).toBe('+919999888877');
      // Preserved Servora-specific platform role
      expect(user?.globalRole).toBe('PLATFORM_ADMIN');
    });
  });

  // --- Category G: User Deleted Webhook ---
  describe('Category G: User Deleted Webhook Flow (Data Retention)', () => {
    it('should soft-deactivate user (isActive: false) without deleting records or corrupting tenant data', async () => {
      await userModel.create({
        email: 'to_delete@servora.app',
        firstName: 'Departing',
        externalAuthId: 'clerk_user_delete_101',
        globalRole: 'USER',
        isActive: true,
      });

      const deletePayload = JSON.stringify({
        object: 'event',
        type: 'user.deleted',
        data: {
          id: 'clerk_user_delete_101',
        },
      });
      const { headers } = signPayload(deletePayload);

      await webhooksService.processClerkWebhook(deletePayload, headers);

      // Verify user document still exists for historical audit logs, but isActive is false
      const user = await userModel.findOne({ externalAuthId: 'clerk_user_delete_101' });
      expect(user).toBeDefined();
      expect(user?.isActive).toBe(false);
    });
  });

  // --- Category I: Duplicate Webhook Delivery ---
  describe('Category I: Idempotent Webhook Deduplication', () => {
    it('should detect duplicate delivery of the same svix-id and acknowledge safely without reprocessing', async () => {
      const payload = JSON.stringify({
        object: 'event',
        type: 'user.created',
        data: {
          id: 'clerk_user_dedup_202',
          email_addresses: [{ email_address: 'dedup@servora.app' }],
          first_name: 'Dedup',
        },
      });
      const { msgId, headers } = signPayload(payload, 'msg_fixed_dedup_id_999');

      // First delivery: processes successfully
      const firstResult = await webhooksService.processClerkWebhook(payload, headers);
      expect(firstResult.received).toBe(true);
      expect(firstResult.duplicate).toBeUndefined();

      // Verify event was recorded in processed_webhook_events
      const recorded = await processedEventModel.findOne({ eventId: msgId });
      expect(recorded).toBeDefined();
      expect(recorded?.eventType).toBe('user.created');

      // Second delivery: identical svix-id
      const secondResult = await webhooksService.processClerkWebhook(payload, headers);
      expect(secondResult.received).toBe(true);
      expect(secondResult.duplicate).toBe(true);

      // Verify only 1 User record exists
      const count = await userModel.countDocuments({ externalAuthId: 'clerk_user_dedup_202' });
      expect(count).toBe(1);
    });
  });
});
