import { describe, it, expect } from 'vitest';
import {
  TenantContextService,
  TenantContextMissingException,
  TenantViolationException,
} from '../src/database/tenant-context';

describe('TenantContextService (Category F & I: Tenant Context)', () => {
  const service = new TenantContextService();

  it('should return undefined when no context is active', () => {
    expect(service.hasOrganizationContext()).toBe(false);
    expect(service.getOrganizationId()).toBeUndefined();
    expect(service.getContext()).toBeUndefined();
  });

  it('should throw TenantContextMissingException when requiring missing organization', () => {
    expect(() => service.requireOrganizationId()).toThrow(TenantContextMissingException);
  });

  it('should bind and expose tenant context synchronously via run()', () => {
    const orgId = 'org_alpha_123';

    service.run({ organizationId: orgId, role: 'BUSINESS_OWNER' }, () => {
      expect(service.hasOrganizationContext()).toBe(true);
      expect(service.getOrganizationId()).toBe(orgId);
      expect(service.requireOrganizationId()).toBe(orgId);
      expect(service.getContext()?.role).toBe('BUSINESS_OWNER');
    });

    // Context is cleared after run completes
    expect(service.getOrganizationId()).toBeUndefined();
  });

  it('should bind and preserve tenant context across asynchronous operations via runAsync()', async () => {
    const orgId = 'org_beta_456';

    await service.runAsync({ organizationId: orgId, userId: 'usr_789' }, async () => {
      expect(service.getOrganizationId()).toBe(orgId);

      // Simulate async delay / I/O
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(service.getOrganizationId()).toBe(orgId);
      expect(service.getContext()?.userId).toBe('usr_789');
    });

    expect(service.getOrganizationId()).toBeUndefined();
  });

  it('should isolate concurrent asynchronous execution contexts', async () => {
    const results = await Promise.all([
      service.runAsync({ organizationId: 'tenant_1' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return service.getOrganizationId();
      }),
      service.runAsync({ organizationId: 'tenant_2' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getOrganizationId();
      }),
    ]);

    expect(results).toEqual(['tenant_1', 'tenant_2']);
  });

  it('should format TenantViolationException with requested and active tenant IDs', () => {
    const error = new TenantViolationException('org_bad', 'org_active');
    expect(error.requestedTenantId).toBe('org_bad');
    expect(error.activeTenantId).toBe('org_active');
    expect(error.message).toContain("requested tenant 'org_bad'");
    expect(error.message).toContain("active tenant context 'org_active'");
  });
});
