import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '@servora/types';

/**
 * Parameter decorator to inject the complete AuthContext (userId, externalAuthId, organizationId, role).
 */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.authContext;
  },
);
