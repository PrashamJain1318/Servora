import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Schema, Document, Types } from 'mongoose';
import {
  TenantContextService,
  TenantContextMissingException,
  TenantViolationException,
} from '../src/database/tenant-context';
import {
  TenantAwareRepository,
  TenantScopedEntity,
} from '../src/database/tenant-aware/tenant-aware.repository';

// Concrete test entity implementing TenantScopedEntity
interface TestItemDocument extends Document, TenantScopedEntity {
  name: string;
  category: string;
}

const TestItemSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
  },
  { timestamps: true },
);

// Test repository subclassing TenantAwareRepository
class TestItemRepository extends TenantAwareRepository<TestItemDocument> {}

describe('TenantAwareRepository & Cross-Tenant Protection (Categories G, H, I, J)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let tenantContext: TenantContextService;
  let repository: TestItemRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    const model = connection.model<TestItemDocument>('TestItem', TestItemSchema);
    tenantContext = new TenantContextService();
    repository = new TestItemRepository(model, tenantContext);
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await connection.models['TestItem']?.deleteMany({});
  });

  // --- Category I: Missing Tenant Context Fails Safely ---
  describe('Missing Tenant Context Safeguard', () => {
    it('should throw TenantContextMissingException when attempting to find without tenant context', async () => {
      await expect(repository.find()).rejects.toThrow(TenantContextMissingException);
    });

    it('should throw TenantContextMissingException when attempting to create without tenant context', async () => {
      await expect(repository.create({ name: 'Orphan Item', category: 'General' })).rejects.toThrow(
        TenantContextMissingException,
      );
    });

    it('should throw TenantContextMissingException when attempting to count without tenant context', async () => {
      await expect(repository.countDocuments()).rejects.toThrow(TenantContextMissingException);
    });
  });

  // --- Category G: Tenant-Aware Repository Auto-Scoping ---
  describe('Automatic Tenant Scoping', () => {
    const orgA = new Types.ObjectId().toString();

    it('should automatically stamp created records with the active organizationId', async () => {
      await tenantContext.runAsync({ organizationId: orgA }, async () => {
        const item = await repository.create({ name: 'Ceramic Prep', category: 'Detailing' });

        expect(item._id).toBeDefined();
        expect(item.organizationId.toString()).toBe(orgA);
        expect(item.name).toBe('Ceramic Prep');
      });
    });

    it('should automatically scope find queries to the active organizationId', async () => {
      await tenantContext.runAsync({ organizationId: orgA }, async () => {
        await repository.create({ name: 'Item 1', category: 'A' });
        await repository.create({ name: 'Item 2', category: 'A' });

        const items = await repository.find({ category: 'A' });
        expect(items).toHaveLength(2);
        expect(items.every((i) => i.organizationId.toString() === orgA)).toBe(true);
      });
    });

    it('should automatically scope findById to the active organizationId', async () => {
      let createdId: string;

      await tenantContext.runAsync({ organizationId: orgA }, async () => {
        const item = await repository.create({ name: 'Target Item', category: 'Special' });
        createdId = item._id.toString();

        const found = await repository.findById(createdId);
        expect(found).not.toBeNull();
        expect(found?.name).toBe('Target Item');
      });
    });
  });

  // --- Category H: Cross-Tenant Isolation (MANDATORY TEST) ---
  describe('Cross-Tenant Data Isolation Enforcement', () => {
    const orgA = new Types.ObjectId().toString();
    const orgB = new Types.ObjectId().toString();

    it('should NEVER return Organization A data when querying in Organization B context', async () => {
      let orgAItemId: string;

      // Organization A creates private tenant data
      await tenantContext.runAsync({ organizationId: orgA }, async () => {
        const item = await repository.create({
          name: 'Secret Org A Process',
          category: 'Proprietary',
        });
        orgAItemId = item._id.toString();
        expect(item.organizationId.toString()).toBe(orgA);
      });

      // Organization B executes query for same category
      await tenantContext.runAsync({ organizationId: orgB }, async () => {
        const items = await repository.find({ category: 'Proprietary' });
        expect(items).toHaveLength(0); // MUST be empty

        const allItems = await repository.find();
        expect(allItems).toHaveLength(0); // MUST be empty

        // Attempting to query Org A item by its known ID in Org B context returns null
        const byId = await repository.findById(orgAItemId);
        expect(byId).toBeNull();

        const count = await repository.countDocuments();
        expect(count).toBe(0);
      });
    });

    it('should throw TenantViolationException if a query explicitly requests a different tenant than active context', async () => {
      await tenantContext.runAsync({ organizationId: orgA }, async () => {
        // Active context is orgA, but caller explicitly injects organizationId: orgB
        await expect(repository.find({ organizationId: orgB } as any)).rejects.toThrow(
          TenantViolationException,
        );

        await expect(
          repository.create({ name: 'Sneaky Item', category: 'Hack', organizationId: orgB } as any),
        ).rejects.toThrow(TenantViolationException);
      });
    });
  });

  // --- Category J: Transaction Readiness ---
  describe('Transaction & Session Readiness', () => {
    it('should accept session option and support transactional operations', async () => {
      const orgId = new Types.ObjectId().toString();

      await tenantContext.runAsync({ organizationId: orgId }, async () => {
        const session = await connection.startSession();
        try {
          // Verify method signatures accept QueryOptions/CountOptions with session
          const items = await repository.find({}, null, { session });
          expect(items).toEqual([]);

          const count = await repository.countDocuments({}, { session });
          expect(count).toBe(0);
        } finally {
          await session.endSession();
        }
      });
    });
  });
});
