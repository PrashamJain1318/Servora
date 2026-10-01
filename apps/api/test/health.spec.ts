import { describe, it, expect } from 'vitest';
import { HealthController } from '../src/health/health.controller';

describe('HealthController (Smoke Test)', () => {
  it('should return status "ok" and service "servora-api"', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('servora-api');
    expect(result.timestamp).toBeDefined();
  });
});
