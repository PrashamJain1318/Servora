import { describe, it, expect } from 'vitest';
import { HealthController } from '../src/health/health.controller';
import { DatabaseHealthService } from '../src/database/database-health.service';

describe('HealthController (Category K: API & Database Health)', () => {
  it('should report database as "connected" when connection.readyState is 1', () => {
    const mockConnection: any = { readyState: 1 };
    const dbHealthService = new DatabaseHealthService(mockConnection);
    process.env['MONGODB_URI'] = 'mongodb://localhost:27017/servora_test';

    const controller = new HealthController(dbHealthService);
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('servora-api');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeDefined();
  });

  it('should report database as "disconnected" when connection.readyState is 0', () => {
    const mockConnection: any = { readyState: 0 };
    const dbHealthService = new DatabaseHealthService(mockConnection);
    process.env['MONGODB_URI'] = 'mongodb://localhost:27017/servora_test';

    const controller = new HealthController(dbHealthService);
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('disconnected');
  });

  it('should report database as "unconfigured" when MONGODB_URI is not set', () => {
    const originalUri = process.env['MONGODB_URI'];
    delete process.env['MONGODB_URI'];

    const mockConnection: any = { readyState: 0 };
    const dbHealthService = new DatabaseHealthService(mockConnection);

    const controller = new HealthController(dbHealthService);
    const result = controller.getHealth();

    expect(result.database).toBe('unconfigured');

    // Restore
    if (originalUri) process.env['MONGODB_URI'] = originalUri;
  });
});
