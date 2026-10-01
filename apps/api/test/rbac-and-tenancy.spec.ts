import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { User, UserSchema } from '../src/modules/users/schemas/user.schema';
import {
  Organization,
  OrganizationSchema,
} from '../src/modules/organizations/schemas/organization.schema';
import { Membership, MembershipSchema } from '../src/modules/memberships/schemas/membership.schema';
import { OrganizationGuard } from '../src/auth/guards/organization.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { TenantInterceptor } from '../src/auth/interceptors/tenant.interceptor';
import { TenantContextService } from '../src/database/tenant-context/tenant-context.service';
import { TenantContextMissingException } from '../src/database/tenant-context/tenant-context.exceptions';
import {
  TenantAwareRepository,
  TenantScopedEntity,
} from '../src/database/tenant-aware/tenant-aware.repository';
import { AuthController } from '../src/auth/auth.controller';
import { REQUIRE_TENANT_KEY, ROLES_KEY } from '../src/auth/auth.constants';

// Test entity & repository for verifying TenantAwareRepository within Auth & RBAC
interface SampleItemDoc extends mongoose.Document, TenantScopedEntity {
  name: string;
}

const SampleItemSchema = new mongoose.Schema<SampleItemDoc>({
  name: { type: String, required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
});

class SampleItemRepository extends TenantAwareRepository<SampleItemDoc> {}

describe('RBAC & Multi-Tenant Authorization (Categories J, K, L, M, N, P, Q, R, S)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let userModel: Model<User>;
  let orgModel: Model<Organization>;
  let membershipModel: Model<Membership>;
  let sampleItemModel: Model<SampleItemDoc>;

  let reflector: Reflector;
  let tenantContext: TenantContextService;
  let orgGuard: OrganizationGuard;
  let rolesGuard: RolesGuard;
  let tenantInterceptor: TenantInterceptor;
  let sampleRepository: SampleItemRepository;
  let authController: AuthController;

  const createMockContext = (
    user: any,
    headers: Record<string, string> = {},
    handlerRoles?: string[],
    requireTenant = true,
  ): ExecutionContext => {
    const request: any = {
      headers,
      user,
      authContext: user
        ? {
            userId: user._id.toString(),
            externalAuthId: user.externalAuthId,
            email: user.email,
            globalRole: user.globalRole,
          }
        : undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();

    userModel = connection.model(User.name, UserSchema);
    orgModel = connection.model(Organization.name, OrganizationSchema);
    membershipModel = connection.model(Membership.name, MembershipSchema);
    sampleItemModel = connection.model('SampleItem', SampleItemSchema);

    await userModel.syncIndexes();
    await orgModel.syncIndexes();
    await membershipModel.syncIndexes();

    reflector = new Reflector();
    tenantContext = new TenantContextService();
    orgGuard = new OrganizationGuard(reflector, membershipModel);
    rolesGuard = new RolesGuard(reflector);
    tenantInterceptor = new TenantInterceptor(tenantContext);
    sampleRepository = new SampleItemRepository(sampleItemModel, tenantContext);
    authController = new AuthController(tenantContext);
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await orgModel.deleteMany({});
    await membershipModel.deleteMany({});
    await sampleItemModel.deleteMany({});
  });

  // --- Category J & P: Organization Membership Resolution & TenantContext Population ---
  describe('Category J & P: Membership Resolution and TenantContext Integration', () => {
    it('should resolve active membership, attach role, and populate TenantContext via TenantInterceptor', async () => {
      const user = await userModel.create({
        email: 'founder@apex.com',
        firstName: 'Apex',
        lastName: 'Founder',
        externalAuthId: 'clerk_owner_1',
        globalRole: 'USER',
      });

      const org = await orgModel.create({
        name: 'Apex Detailing',
        slug: 'apex-detailing',
      });

      await membershipModel.create({
        organizationId: org._id,
        userId: user._id,
        role: 'BUSINESS_OWNER',
        status: 'ACTIVE',
      });

      // Mock reflector: route requires tenant
      (reflector as any).getAllAndOverride = (key: string) => {
        if (key === REQUIRE_TENANT_KEY) return true;
        return undefined;
      };

      const context = createMockContext(user, {
        'x-organization-id': org._id.toString(),
      });

      // 1. OrganizationGuard activates
      const guardPassed = await orgGuard.canActivate(context);
      expect(guardPassed).toBe(true);

      const req = context.switchToHttp().getRequest();
      expect(req.authContext.organizationId).toBe(org._id.toString());
      expect(req.authContext.role).toBe('BUSINESS_OWNER');

      // 2. TenantInterceptor wraps downstream execution inside AsyncLocalStorage
      let tenantInsideInterceptor: string | undefined;

      const callHandler = {
        handle: () => {
          tenantInsideInterceptor = tenantContext.getOrganizationId();
          return of({ executed: true });
        },
      };

      await lastValueFrom(tenantInterceptor.intercept(context, callHandler as any));

      expect(tenantInsideInterceptor).toBe(org._id.toString());
      // Outside the interceptor, context is cleanly unbound
      expect(tenantContext.getOrganizationId()).toBeUndefined();
    });
  });

  // --- Category K & Q: Unauthorized Organization Access & Cross-Tenant Protection ---
  describe('Category K & Q: Unauthorized Access & Cross-Tenant Protection', () => {
    it('should reject request with 403 Forbidden when user attempts to access an organization they do not belong to', async () => {
      const userA = await userModel.create({
        email: 'userA@orgA.com',
        externalAuthId: 'clerk_user_a',
        globalRole: 'USER',
      });

      const orgA = await orgModel.create({ name: 'Org A', slug: 'org-a' });
      const orgB = await orgModel.create({ name: 'Org B', slug: 'org-b' });

      // User A only has membership in Org A
      await membershipModel.create({
        organizationId: orgA._id,
        userId: userA._id,
        role: 'BUSINESS_OWNER',
        status: 'ACTIVE',
      });

      (reflector as any).getAllAndOverride = (key: string) =>
        key === REQUIRE_TENANT_KEY ? true : undefined;

      // User A attempts to access Org B
      const context = createMockContext(userA, {
        'x-organization-id': orgB._id.toString(),
      });

      await expect(orgGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(orgGuard.canActivate(context)).rejects.toThrow(
        'Access denied to the specified organization',
      );
    });

    it('should reject access if membership status is REVOKED or INVITED (not ACTIVE)', async () => {
      const user = await userModel.create({
        email: 'revoked@org.com',
        externalAuthId: 'clerk_revoked',
        globalRole: 'USER',
      });

      const org = await orgModel.create({ name: 'Test Org', slug: 'test-org' });

      await membershipModel.create({
        organizationId: org._id,
        userId: user._id,
        role: 'STAFF',
        status: 'REVOKED',
      });

      (reflector as any).getAllAndOverride = (key: string) =>
        key === REQUIRE_TENANT_KEY ? true : undefined;

      const context = createMockContext(user, {
        'x-organization-id': org._id.toString(),
      });

      await expect(orgGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should reject malformed or non-ObjectId organization identifiers with 403 Forbidden', async () => {
      const user = await userModel.create({
        email: 'user@test.com',
        externalAuthId: 'clerk_test',
        globalRole: 'USER',
      });

      (reflector as any).getAllAndOverride = (key: string) =>
        key === REQUIRE_TENANT_KEY ? true : undefined;

      const context = createMockContext(user, {
        'x-organization-id': 'not-a-valid-object-id',
      });

      await expect(orgGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  // --- Category R: Missing Tenant Context ---
  describe('Category R: Missing Tenant Context', () => {
    it('should throw 400 Bad Request when x-organization-id is missing on a @RequireTenant route', async () => {
      const user = await userModel.create({
        email: 'user@test.com',
        externalAuthId: 'clerk_test',
        globalRole: 'USER',
      });

      (reflector as any).getAllAndOverride = (key: string) =>
        key === REQUIRE_TENANT_KEY ? true : undefined;

      const context = createMockContext(user, {}); // No x-organization-id

      await expect(orgGuard.canActivate(context)).rejects.toThrow(BadRequestException);
      await expect(orgGuard.canActivate(context)).rejects.toThrow(
        'Missing required x-organization-id header',
      );
    });

    it('should prevent tenant-aware repositories from executing without tenant context', async () => {
      expect(tenantContext.hasOrganizationContext()).toBe(false);

      await expect(sampleRepository.create({ name: 'Illegal Item' } as any)).rejects.toThrow(
        TenantContextMissingException,
      );
    });
  });

  // --- Categories L, M, N: Role-Based Access Control (RBAC) ---
  describe('Categories L, M, N: RBAC Hierarchy Authorization', () => {
    const setupRbacContext = (role: string, requiredRoles: string[]) => {
      const context = createMockContext({ _id: new Types.ObjectId() });
      const req = context.switchToHttp().getRequest();
      req.authContext = { role };

      (reflector as any).getAllAndOverride = (key: string) => {
        if (key === ROLES_KEY) return requiredRoles;
        return undefined;
      };

      return context;
    };

    // Category L: BUSINESS_OWNER
    describe('Category L: BUSINESS_OWNER Permissions', () => {
      it('should permit BUSINESS_OWNER to access OWNER-only endpoints', () => {
        const context = setupRbacContext('BUSINESS_OWNER', ['BUSINESS_OWNER']);
        expect(rolesGuard.canActivate(context)).toBe(true);
      });

      it('should permit BUSINESS_OWNER to access ADMIN-level and STAFF-level endpoints via hierarchy', () => {
        const adminEndpoint = setupRbacContext('BUSINESS_OWNER', ['BUSINESS_ADMIN']);
        expect(rolesGuard.canActivate(adminEndpoint)).toBe(true);

        const staffEndpoint = setupRbacContext('BUSINESS_OWNER', ['STAFF']);
        expect(rolesGuard.canActivate(staffEndpoint)).toBe(true);
      });
    });

    // Category M: BUSINESS_ADMIN
    describe('Category M: BUSINESS_ADMIN Permissions', () => {
      it('should permit BUSINESS_ADMIN to access ADMIN and STAFF endpoints', () => {
        const adminEndpoint = setupRbacContext('BUSINESS_ADMIN', ['BUSINESS_ADMIN']);
        expect(rolesGuard.canActivate(adminEndpoint)).toBe(true);

        const staffEndpoint = setupRbacContext('BUSINESS_ADMIN', ['STAFF']);
        expect(rolesGuard.canActivate(staffEndpoint)).toBe(true);
      });

      it('should reject BUSINESS_ADMIN from OWNER-only endpoints with 403 Forbidden', () => {
        const ownerEndpoint = setupRbacContext('BUSINESS_ADMIN', ['BUSINESS_OWNER']);
        expect(() => rolesGuard.canActivate(ownerEndpoint)).toThrow(ForbiddenException);
      });
    });

    // Category N: STAFF
    describe('Category N: STAFF Permissions', () => {
      it('should permit STAFF to access STAFF-level endpoints', () => {
        const staffEndpoint = setupRbacContext('STAFF', ['STAFF']);
        expect(rolesGuard.canActivate(staffEndpoint)).toBe(true);
      });

      it('should reject STAFF from ADMIN-only or OWNER-only endpoints with 403 Forbidden', () => {
        const adminEndpoint = setupRbacContext('STAFF', ['BUSINESS_ADMIN']);
        expect(() => rolesGuard.canActivate(adminEndpoint)).toThrow(ForbiddenException);

        const ownerEndpoint = setupRbacContext('STAFF', ['BUSINESS_OWNER']);
        expect(() => rolesGuard.canActivate(ownerEndpoint)).toThrow(ForbiddenException);
      });
    });
  });

  // --- Category S: Protected Endpoint Behavior ---
  describe('Category S: Protected API Verification Endpoints', () => {
    it('should return user profile on /api/v1/auth/me', () => {
      const mockUser: any = {
        _id: new Types.ObjectId(),
        email: 'verified@servora.app',
        firstName: 'Ananya',
        lastName: 'Sharma',
        globalRole: 'USER',
        externalAuthId: 'clerk_444',
      };

      const result = authController.getMe(mockUser);
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('verified@servora.app');
      expect(result.data.firstName).toBe('Ananya');
      expect(result.data.globalRole).toBe('USER');
    });

    it('should return tenant and role details on /api/v1/auth/tenant-check', async () => {
      const orgId = new Types.ObjectId().toString();
      const mockAuth: any = {
        organizationId: orgId,
        role: 'BUSINESS_OWNER',
      };

      await tenantContext.runAsync({ organizationId: orgId }, async () => {
        const result = authController.checkTenant(mockAuth);
        expect(result.success).toBe(true);
        expect(result.data.organizationId).toBe(orgId);
        expect(result.data.activeTenantInContext).toBe(orgId);
        expect(result.data.role).toBe('BUSINESS_OWNER');
      });
    });

    it('should confirm role authorization on role-specific endpoints', () => {
      const mockAuth: any = {
        organizationId: 'org_123',
        role: 'BUSINESS_OWNER',
      };

      const ownerResult = authController.ownerOnly(mockAuth);
      expect(ownerResult.message).toBe('BUSINESS_OWNER authorized');

      const adminResult = authController.adminOrOwner(mockAuth);
      expect(adminResult.message).toBe('Admin authorization granted');

      const staffResult = authController.staffAccessible(mockAuth);
      expect(staffResult.message).toBe('Staff authorization granted');
    });
  });
});
