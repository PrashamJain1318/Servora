import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MembershipRole } from '@servora/types';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): Promise<boolean> | boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.authContext?.role as MembershipRole | undefined;

    if (!userRole) {
      throw new ForbiddenException('Tenant membership required for role-based authorization');
    }

    // Role hierarchy evaluation:
    // BUSINESS_OWNER -> can access OWNER, ADMIN, STAFF
    // BUSINESS_ADMIN -> can access ADMIN, STAFF
    // STAFF -> can access STAFF
    const hasPermission = this.evaluateRoleHierarchy(userRole, requiredRoles);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient role permissions. Required: [${requiredRoles.join(', ')}], current: ${userRole}`,
      );
    }

    return true;
  }

  /**
   * Evaluates role hierarchy according to Servora Security Architecture.
   */
  private evaluateRoleHierarchy(
    currentRole: MembershipRole,
    requiredRoles: MembershipRole[],
  ): boolean {
    // Direct match
    if (requiredRoles.includes(currentRole)) {
      return true;
    }

    // BUSINESS_OWNER possesses super-privileges over business operations
    if (currentRole === 'BUSINESS_OWNER') {
      return true;
    }

    // BUSINESS_ADMIN can access STAFF-level endpoints
    if (currentRole === 'BUSINESS_ADMIN' && requiredRoles.includes('STAFF')) {
      return true;
    }

    return false;
  }
}
