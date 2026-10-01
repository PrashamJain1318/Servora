import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserDocument } from '../../modules/users/schemas/user.schema';

/**
 * Parameter decorator to inject the authenticated Servora User document.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserDocument => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
