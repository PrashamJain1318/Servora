import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@servora/types';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'servora-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
