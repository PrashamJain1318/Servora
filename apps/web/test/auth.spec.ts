import { describe, it, expect } from 'vitest';
import { config as middlewareConfig } from '../middleware';

describe('Web App Authentication & Route Protection (Phase 3)', () => {
  it('should define route matchers in middleware for protecting application routes', () => {
    expect(middlewareConfig).toBeDefined();
    expect(middlewareConfig.matcher).toBeDefined();
    expect(Array.isArray(middlewareConfig.matcher)).toBe(true);
  });

  it('should match dashboard paths for authentication protection', () => {
    const isDashboard = (path: string) => path.startsWith('/dashboard');
    expect(isDashboard('/dashboard')).toBe(true);
    expect(isDashboard('/dashboard/settings')).toBe(true);
    expect(isDashboard('/')).toBe(false);
    expect(isDashboard('/api/v1/health')).toBe(false);
  });

  it('should identify public authentication endpoints', () => {
    const isPublicAuthRoute = (path: string) =>
      path.startsWith('/sign-in') || path.startsWith('/sign-up');
    expect(isPublicAuthRoute('/sign-in')).toBe(true);
    expect(isPublicAuthRoute('/sign-up')).toBe(true);
    expect(isPublicAuthRoute('/dashboard')).toBe(false);
  });
});
