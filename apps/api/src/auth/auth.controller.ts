import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import type { AuthContext } from '@servora/types';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { OrganizationGuard } from './guards/organization.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { CurrentUser } from './decorators/current-user.decorator';
import { CurrentAuth } from './decorators/current-auth.decorator';
import { RequireTenant } from './decorators/require-tenant.decorator';
import { Roles } from './decorators/roles.decorator';
import { TenantContextService } from '../database/tenant-context/tenant-context.service';
import type { UserDocument } from '../modules/users/schemas/user.schema';

@Controller('auth')
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantInterceptor)
export class AuthController {
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Returns profile of the currently authenticated Clerk user.
   */
  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return {
      success: true,
      data: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        globalRole: user.globalRole,
        externalAuthId: user.externalAuthId,
      },
    };
  }

  /**
   * Verifies organization membership and tenant context population in AsyncLocalStorage.
   */
  @Get('tenant-check')
  @UseGuards(OrganizationGuard)
  @RequireTenant()
  checkTenant(@CurrentAuth() auth: AuthContext) {
    return {
      success: true,
      data: {
        organizationId: auth.organizationId,
        role: auth.role,
        activeTenantInContext: this.tenantContext.getOrganizationId(),
      },
    };
  }

  /**
   * Verified endpoint requiring BUSINESS_OWNER role.
   */
  @Get('owner-only')
  @UseGuards(OrganizationGuard, RolesGuard)
  @RequireTenant()
  @Roles('BUSINESS_OWNER')
  ownerOnly(@CurrentAuth() auth: AuthContext) {
    return {
      success: true,
      message: 'BUSINESS_OWNER authorized',
      data: {
        organizationId: auth.organizationId,
        role: auth.role,
      },
    };
  }

  /**
   * Verified endpoint requiring BUSINESS_ADMIN or higher.
   */
  @Get('admin-or-owner')
  @UseGuards(OrganizationGuard, RolesGuard)
  @RequireTenant()
  @Roles('BUSINESS_ADMIN')
  adminOrOwner(@CurrentAuth() auth: AuthContext) {
    return {
      success: true,
      message: 'Admin authorization granted',
      data: {
        organizationId: auth.organizationId,
        role: auth.role,
      },
    };
  }

  /**
   * Verified endpoint requiring STAFF or higher.
   */
  @Get('staff-accessible')
  @UseGuards(OrganizationGuard, RolesGuard)
  @RequireTenant()
  @Roles('STAFF')
  staffAccessible(@CurrentAuth() auth: AuthContext) {
    return {
      success: true,
      message: 'Staff authorization granted',
      data: {
        organizationId: auth.organizationId,
        role: auth.role,
      },
    };
  }
}
