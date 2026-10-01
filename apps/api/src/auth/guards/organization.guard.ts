import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { IS_PUBLIC_KEY, REQUIRE_TENANT_KEY } from '../auth.constants';
import { Membership } from '../../modules/memberships/schemas/membership.schema';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const orgIdHeader = request.headers['x-organization-id'] as string | undefined;

    if (!orgIdHeader) {
      if (requireTenant) {
        throw new BadRequestException('Missing required x-organization-id header');
      }
      return true;
    }

    // Validate ObjectId format
    if (!isValidObjectId(orgIdHeader)) {
      throw new ForbiddenException('Invalid organization identifier');
    }

    // Require authenticated user context
    const authContext = request.authContext;
    if (!authContext || !authContext.userId) {
      throw new UnauthorizedException(
        'User authentication required before organization resolution',
      );
    }

    // Query active membership
    const membership = await this.membershipModel.findOne({
      organizationId: orgIdHeader,
      userId: authContext.userId,
      status: 'ACTIVE',
    });

    if (!membership) {
      // Do not leak existence of unrelated organization data; return 403 Forbidden
      throw new ForbiddenException('Access denied to the specified organization');
    }

    // Populate tenant identity and membership role into AuthContext
    authContext.organizationId = orgIdHeader;
    authContext.role = membership.role;
    request.membership = membership;

    return true;
  }
}
