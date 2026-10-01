import { SetMetadata } from '@nestjs/common';
import { REQUIRE_TENANT_KEY } from '../auth.constants';

/**
 * Decorator to require a valid tenant context (via x-organization-id header)
 * and verified membership for the route.
 */
export const RequireTenant = () => SetMetadata(REQUIRE_TENANT_KEY, true);
