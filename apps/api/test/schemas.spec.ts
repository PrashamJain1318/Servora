import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { User, UserSchema } from '../src/modules/users/schemas/user.schema';
import {
  Organization,
  OrganizationSchema,
} from '../src/modules/organizations/schemas/organization.schema';
import { Membership, MembershipSchema } from '../src/modules/memberships/schemas/membership.schema';

describe('Foundational Schemas & Index Constraints (Categories A, B, C, D, E)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let UserModel: Model<User>;
  let OrgModel: Model<Organization>;
  let MembershipModel: Model<Membership>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    connection = await mongoose.createConnection(uri).asPromise();

    UserModel = connection.model(User.name, UserSchema);
    OrgModel = connection.model(Organization.name, OrganizationSchema);
    MembershipModel = connection.model(Membership.name, MembershipSchema);

    // Ensure all schema indexes (including compound unique) are synchronized in MongoDB
    await UserModel.syncIndexes();
    await OrgModel.syncIndexes();
    await MembershipModel.syncIndexes();
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await OrgModel.deleteMany({});
    await MembershipModel.deleteMany({});
  });

  // --- Category A: Database Connection ---
  it('should establish an active MongoDB connection', () => {
    expect(connection.readyState).toBe(1); // 1 = connected
  });

  // --- Category B: User Schema ---
  describe('User Schema', () => {
    it('should create and retrieve a valid user', async () => {
      const user = await UserModel.create({
        email: 'test@servora.app',
        firstName: 'Vikram',
        lastName: 'Sharma',
        externalAuthId: 'clerk_user_123',
        globalRole: 'USER',
      });

      expect(user._id).toBeDefined();
      expect(user.email).toBe('test@servora.app');
      expect(user.globalRole).toBe('USER');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should enforce unique email constraint', async () => {
      await UserModel.create({ email: 'duplicate@servora.app' });

      await expect(UserModel.create({ email: 'duplicate@servora.app' })).rejects.toThrow(/E11000/);
    });

    it('should enforce lowercase normalization on email', async () => {
      const user = await UserModel.create({ email: 'UPPERCASE@SERVORA.APP' });
      expect(user.email).toBe('uppercase@servora.app');
    });

    it('should allow multiple users with undefined externalAuthId (sparse unique)', async () => {
      const user1 = await UserModel.create({ email: 'user1@servora.app' });
      const user2 = await UserModel.create({ email: 'user2@servora.app' });

      expect(user1._id).toBeDefined();
      expect(user2._id).toBeDefined();
    });

    it('should reject duplicate externalAuthId when defined', async () => {
      await UserModel.create({ email: 'u1@servora.app', externalAuthId: 'clerk_dup' });

      await expect(
        UserModel.create({ email: 'u2@servora.app', externalAuthId: 'clerk_dup' }),
      ).rejects.toThrow(/E11000/);
    });
  });

  // --- Category C: Organization Schema ---
  describe('Organization Schema', () => {
    it('should create and retrieve a valid organization tenant', async () => {
      const org = await OrgModel.create({
        name: 'Apex Detailing Studio',
        slug: 'apex-detailing',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        branding: {
          primaryColor: '#2563eb',
        },
        settings: {
          bookingBufferMinutes: 20,
          maxAdvanceBookingDays: 45,
          autoConfirmBookings: true,
        },
      });

      expect(org._id).toBeDefined();
      expect(org.slug).toBe('apex-detailing');
      expect(org.status).toBe('ACTIVE');
      expect(org.settings.bookingBufferMinutes).toBe(20);
    });

    it('should enforce unique slug constraint across organizations', async () => {
      await OrgModel.create({
        name: 'Studio Alpha',
        slug: 'studio-alpha',
      });

      await expect(
        OrgModel.create({
          name: 'Studio Alpha Duplicate',
          slug: 'studio-alpha',
        }),
      ).rejects.toThrow(/E11000/);
    });

    it('should reject invalid slug formats with uppercase or spaces', async () => {
      await expect(
        OrgModel.create({
          name: 'Invalid Org',
          slug: 'Invalid Slug With Spaces',
        }),
      ).rejects.toThrow();
    });
  });

  // --- Category D & E: Membership Schema & Constraints ---
  describe('Membership Schema & Multi-Tenancy Uniqueness', () => {
    it('should create a valid membership linking User and Organization', async () => {
      const org = await OrgModel.create({ name: 'Studio One', slug: 'studio-one' });
      const user = await UserModel.create({ email: 'owner@studio.com' });

      const membership = await MembershipModel.create({
        organizationId: org._id,
        userId: user._id,
        role: 'BUSINESS_OWNER',
        status: 'ACTIVE',
      });

      expect(membership._id).toBeDefined();
      expect(membership.organizationId.toString()).toBe(org._id.toString());
      expect(membership.userId.toString()).toBe(user._id.toString());
      expect(membership.role).toBe('BUSINESS_OWNER');
    });

    it('should prevent duplicate memberships for the same user in the same organization (Compound Unique Index)', async () => {
      const org = await OrgModel.create({ name: 'Studio Unique', slug: 'studio-unique' });
      const user = await UserModel.create({ email: 'member@studio.com' });

      // First membership succeeds
      await MembershipModel.create({
        organizationId: org._id,
        userId: user._id,
        role: 'STAFF',
      });

      // Second membership for SAME user in SAME organization must fail with E11000
      await expect(
        MembershipModel.create({
          organizationId: org._id,
          userId: user._id,
          role: 'BUSINESS_ADMIN',
        }),
      ).rejects.toThrow(/E11000/);
    });

    it('should ALLOW a single user to belong to MULTIPLE different organizations', async () => {
      const org1 = await OrgModel.create({ name: 'First Studio', slug: 'first-studio' });
      const org2 = await OrgModel.create({ name: 'Second Studio', slug: 'second-studio' });
      const user = await UserModel.create({ email: 'multi@org.com' });

      // Membership in Org 1
      const m1 = await MembershipModel.create({
        organizationId: org1._id,
        userId: user._id,
        role: 'BUSINESS_OWNER',
      });

      // Membership in Org 2 (SAME userId, DIFFERENT organizationId)
      const m2 = await MembershipModel.create({
        organizationId: org2._id,
        userId: user._id,
        role: 'STAFF',
      });

      expect(m1._id).toBeDefined();
      expect(m2._id).toBeDefined();
      expect(m1.organizationId.toString()).not.toBe(m2.organizationId.toString());

      // Query user's memberships
      const userMemberships = await MembershipModel.find({ userId: user._id });
      expect(userMemberships).toHaveLength(2);
    });
  });
});
