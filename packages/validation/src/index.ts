import { z } from 'zod';

/**
 * @servora/validation
 * Base validation primitives and reusable utility schemas.
 */

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  service: z.string(),
  timestamp: z.string().optional(),
  uptime: z.number().optional(),
});

export { z };
