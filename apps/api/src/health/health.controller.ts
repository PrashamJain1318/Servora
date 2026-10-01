import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@servora/types';
import { DatabaseHealthService } from '../database/database-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly dbHealthService: DatabaseHealthService) {}

  @Get()
  getHealth(): HealthResponse {
    const dbState = this.dbHealthService.getConnectionState();

    return {
      status: 'ok',
      service: 'servora-api',
      database: dbState,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
