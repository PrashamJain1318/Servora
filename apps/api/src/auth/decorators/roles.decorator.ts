import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@servora/types';
import { ROLES_KEY } from '../auth.constants';

/**
 * Decorator to require one or more tenant membership roles to access an endpoint.
 */
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);
