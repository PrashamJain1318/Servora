import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth.constants';

/**
 * Decorator to mark routes as publicly accessible, bypassing ClerkAuthGuard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
