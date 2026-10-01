import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User, UserSchema } from '../src/modules/users/schemas/user.schema';
import { ClerkAuthService } from '../src/auth/services/clerk-auth.service';
import { ClerkAuthGuard } from '../src/auth/guards/clerk-auth.guard';
import { IS_PUBLIC_KEY } from '../src/auth/auth.constants';

describe('Clerk Authentication & User Resolution (Categories A, B, C, D, O)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let userModel: Model<User>;
  let authService: ClerkAuthService;
  let reflector: Reflector;
  let authGuard: ClerkAuthGuard;

  // Helper to build a valid mock JWT with a given subject (sub)
  const createMockJwt = (sub: string): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64');
    return `${header}.${payload}.mockSignature`;
  };

  const createMockContext = (authHeader?: string, isPublic = false): ExecutionContext => {
    const request: any = {
      headers: authHeader ? { authorization: authHeader } : {},
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
    await userModel.syncIndexes();

    authService = new ClerkAuthService(userModel);
    reflector = new Reflector();
    authGuard = new ClerkAuthGuard(reflector, authService);
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
  });

  // --- Category A & D: Clerk Authentication Guard & User Resolution ---
  describe('Category A & D: Token Validation & Servora User Resolution', () => {
    it('should validate Clerk token, resolve active Servora user, and attach authContext to request', async () => {
      const user = await userModel.create({
        email: 'priya@servora.app',
        firstName: 'Priya',
        lastName: 'Nair',
        externalAuthId: 'clerk_user_valid_123',
        globalRole: 'USER',
        isActive: true,
      });

      const token = createMockJwt('clerk_user_valid_123');
      const context = createMockContext(`Bearer ${token}`);

      const canActivate = await authGuard.canActivate(context);
      expect(canActivate).toBe(true);

      const req = context.switchToHttp().getRequest();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
      expect(req.authContext).toBeDefined();
      expect(req.authContext.userId).toBe(user._id.toString());
      expect(req.authContext.externalAuthId).toBe('clerk_user_valid_123');
      expect(req.authContext.email).toBe('priya@servora.app');
      expect(req.authContext.globalRole).toBe('USER');
    });

    it('should reject request when user exists in Clerk but not in Servora DB', async () => {
      const token = createMockJwt('clerk_user_unregistered');
      const context = createMockContext(`Bearer ${token}`);

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'Authenticated user not found or deactivated in Servora',
      );
    });

    it('should reject deactivated Servora users (isActive = false)', async () => {
      await userModel.create({
        email: 'deactivated@servora.app',
        firstName: 'Inactive',
        externalAuthId: 'clerk_user_deactivated',
        globalRole: 'USER',
        isActive: false,
      });

      const token = createMockJwt('clerk_user_deactivated');
      const context = createMockContext(`Bearer ${token}`);

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  // --- Category B: Missing Authentication ---
  describe('Category B: Missing Authentication', () => {
    it('should throw 401 Unauthorized when authorization header is completely missing', async () => {
      const context = createMockContext(undefined);
      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'Authorization header is missing',
      );
    });

    it('should allow public endpoints to bypass ClerkAuthGuard without token', async () => {
      const context = createMockContext(undefined);
      const spy = vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const canActivate = await authGuard.canActivate(context);
      expect(canActivate).toBe(true);

      spy.mockRestore();
    });
  });

  // --- Category C: Invalid Authentication ---
  describe('Category C: Invalid Authentication', () => {
    it('should reject non-Bearer authorization schemes', async () => {
      const context = createMockContext('Basic dXNlcjpwYXNz');
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'Authorization header must use Bearer scheme',
      );
    });

    it('should reject empty or malformed tokens', async () => {
      const context = createMockContext('Bearer ');
      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);

      const malformedContext = createMockContext('Bearer not.a.valid.jwt');
      await expect(authGuard.canActivate(malformedContext)).rejects.toThrow(UnauthorizedException);
    });
  });

  // --- Category O: PLATFORM_ADMIN Behavior ---
  describe('Category O: Platform Admin User Identity', () => {
    it('should identify PLATFORM_ADMIN globalRole distinctly from standard USER', async () => {
      const admin = await userModel.create({
        email: 'superadmin@servora.app',
        firstName: 'Platform',
        lastName: 'Admin',
        externalAuthId: 'clerk_admin_999',
        globalRole: 'PLATFORM_ADMIN',
        isActive: true,
      });

      const token = createMockJwt('clerk_admin_999');
      const context = createMockContext(`Bearer ${token}`);

      await authGuard.canActivate(context);
      const req = context.switchToHttp().getRequest();

      expect(req.authContext.globalRole).toBe('PLATFORM_ADMIN');
      expect(req.authContext.userId).toBe(admin._id.toString());
      // Platform admin does NOT automatically have tenant organization or role populated
      expect(req.authContext.organizationId).toBeUndefined();
      expect(req.authContext.role).toBeUndefined();
    });
  });
});
