import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '@servora/config';

describe('Web App (Smoke Test)', () => {
  it('should have correct metadata and branding config', () => {
    expect(APP_CONFIG.name).toBe('SERVORA');
    expect(APP_CONFIG.tagline).toBe('Turn enquiries into customers.');
  });
});
