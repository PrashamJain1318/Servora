/**
 * @servora/types
 * Foundational shared TypeScript interfaces and response envelopes.
 */

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp?: string;
  uptime?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
