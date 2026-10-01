import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Clerk Webhook Ingestion endpoint.
   * Cryptographically verifies Svix signatures and idempotently processes lifecycle events.
   */
  @Public()
  @Post('clerk')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawPayload =
      req.rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!rawPayload) {
      throw new BadRequestException('Empty webhook payload');
    }

    const result = await this.webhooksService.processClerkWebhook(rawPayload, headers);
    return {
      success: true,
      ...result,
    };
  }
}
