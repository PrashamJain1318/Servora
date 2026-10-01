import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // Global prefix for all API routes
  app.setGlobalPrefix('api/v1');

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);

  logger.log(`🚀 SERVORA API is running on: http://localhost:${port}/api/v1`);
  logger.log(`🩺 Health endpoint: http://localhost:${port}/api/v1/health`);
}

void bootstrap();
