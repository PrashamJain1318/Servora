import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth.constants';
import { ClerkAuthService } from '../services/clerk-auth.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if endpoint is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [scheme, token] = authHeader.split(' ');

    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
      throw new UnauthorizedException('Authorization header must use Bearer scheme');
    }

    // 2. Validate token and resolve Servora User
    const { user, authContext } = await this.clerkAuthService.verifyAndResolveUser(token);

    // 3. Attach authenticated identity to request
    request.user = user;
    request.authContext = authContext;

    return true;
  }
}
