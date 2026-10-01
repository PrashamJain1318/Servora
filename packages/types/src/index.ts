/**
 * @servora/types
 * Foundational shared TypeScript interfaces, enums, and response envelopes.
 */

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  database?: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unconfigured';
  timestamp?: string;
  uptime?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Global User roles (platform level)
 */
export type GlobalRole = 'PLATFORM_ADMIN' | 'USER';

/**
 * Tenant-scoped RBAC roles
 */
export type MembershipRole = 'BUSINESS_OWNER' | 'BUSINESS_ADMIN' | 'STAFF';

/**
 * Tenant membership status
 */
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

/**
 * Organization tenant status
 */
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_ONBOARDING';

/**
 * Tenant Context metadata stored in AsyncLocalStorage
 */
export interface TenantContextData {
  organizationId: string;
  userId?: string;
  role?: MembershipRole | string;
}

/**
 * Verified Authentication Context from Clerk + Servora Database
 */
export interface AuthContext {
  userId: string;
  externalAuthId: string;
  email: string;
  globalRole: GlobalRole;
  organizationId?: string;
  role?: MembershipRole;
}

/**
 * Structure of a Clerk Webhook event payload verified via Svix
 */
export interface ClerkWebhookEvent<T = Record<string, unknown>> {
  data: T;
  object: 'event';
  type: string;
  timestamp: number;
}
