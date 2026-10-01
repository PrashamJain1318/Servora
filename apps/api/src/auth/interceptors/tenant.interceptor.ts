import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { TenantContextService } from '../../database/tenant-context/tenant-context.service';

/**
 * Bridges verified request organization membership with Phase 2 TenantContext.
 * Wraps execution of downstream controllers, services, and repositories in AsyncLocalStorage.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const authContext = request.authContext;

    if (authContext && authContext.organizationId) {
      // Execute downstream handlers inside AsyncLocalStorage with verified tenant context
      return from(
        this.tenantContext.runAsync(
          {
            organizationId: authContext.organizationId,
            userId: authContext.userId,
            role: authContext.role,
          },
          async () => await lastValueFrom(next.handle()),
        ),
      );
    }

    return next.handle();
  }
}
