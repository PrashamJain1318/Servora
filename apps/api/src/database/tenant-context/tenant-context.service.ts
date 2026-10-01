import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContextData } from '@servora/types';
import { TenantContextMissingException } from './tenant-context.exceptions';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextData>();

  /**
   * Executes a synchronous callback within the given tenant context.
   */
  run<T>(context: TenantContextData, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /**
   * Executes an asynchronous callback within the given tenant context.
   */
  runAsync<T>(context: TenantContextData, callback: () => Promise<T>): Promise<T> {
    return this.storage.run(context, callback);
  }

  /**
   * Returns the current organizationId if one is bound to the active context, otherwise undefined.
   */
  getOrganizationId(): string | undefined {
    return this.storage.getStore()?.organizationId;
  }

  /**
   * Returns the active organizationId.
   * Throws TenantContextMissingException if no tenant context is bound.
   */
  requireOrganizationId(): string {
    const orgId = this.getOrganizationId();
    if (!orgId) {
      throw new TenantContextMissingException();
    }
    return orgId;
  }

  /**
   * Checks whether an organization context is currently bound.
   */
  hasOrganizationContext(): boolean {
    return Boolean(this.storage.getStore()?.organizationId);
  }

  /**
   * Returns the entire active tenant context payload.
   */
  getContext(): TenantContextData | undefined {
    return this.storage.getStore();
  }
}
