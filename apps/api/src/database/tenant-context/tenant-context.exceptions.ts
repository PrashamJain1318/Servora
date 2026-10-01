/**
 * Thrown when a tenant-scoped database operation is executed without an active tenant context.
 */
export class TenantContextMissingException extends Error {
  constructor(
    message = 'Tenant context is required for this operation but none was found in the execution context.',
  ) {
    super(message);
    this.name = 'TenantContextMissingException';
    Object.setPrototypeOf(this, TenantContextMissingException.prototype);
  }
}

/**
 * Thrown when an operation attempts to access or mutate data belonging to an organization
 * different from the active tenant context (cross-tenant violation).
 */
export class TenantViolationException extends Error {
  public readonly requestedTenantId: string;
  public readonly activeTenantId: string;

  constructor(requestedTenantId: string, activeTenantId: string) {
    super(
      `Cross-tenant access violation: requested tenant '${requestedTenantId}' does not match active tenant context '${activeTenantId}'.`,
    );
    this.name = 'TenantViolationException';
    this.requestedTenantId = requestedTenantId;
    this.activeTenantId = activeTenantId;
    Object.setPrototypeOf(this, TenantViolationException.prototype);
  }
}
