import { Global, Module, Logger, OnApplicationShutdown } from '@nestjs/common';
import { MongooseModule, InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TenantContextService } from './tenant-context/tenant-context.service';
import { DatabaseHealthService } from './database-health.service';
import { MONGODB_URI_ENV } from './database.constants';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => {
        const logger = new Logger('DatabaseModule');
        const uri = process.env[MONGODB_URI_ENV];

        if (!uri) {
          const errorMsg = `[DatabaseModule] Missing required configuration: "${MONGODB_URI_ENV}". Ensure MONGODB_URI is defined in your environment or .env file before starting the API.`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }

        // Mask sensitive credentials if present in connection string
        const maskedUri = uri.replace(/\/\/(.*)@/, '//***:***@');
        logger.log(`🔌 [DatabaseModule] Initializing connection to MongoDB: ${maskedUri}`);

        return {
          uri,
          serverSelectionTimeoutMS: 5000,
          maxPoolSize: 10,
          minPoolSize: 2,
          retryWrites: true,
          autoIndex: process.env.NODE_ENV !== 'production',
          connectionFactory: (connection: Connection) => {
            connection.on('connected', () => {
              logger.log('✅ [DatabaseModule] MongoDB connection established successfully.');
            });
            connection.on('disconnected', () => {
              logger.warn('⚠️  [DatabaseModule] MongoDB connection disconnected.');
            });
            connection.on('reconnected', () => {
              logger.log('🔄 [DatabaseModule] MongoDB connection reconnected.');
            });
            connection.on('error', (err) => {
              logger.error(
                `❌ [DatabaseModule] MongoDB connection error: ${err.message}`,
                err.stack,
              );
            });
            return connection;
          },
        };
      },
    }),
  ],
  providers: [TenantContextService, DatabaseHealthService],
  exports: [MongooseModule, TenantContextService, DatabaseHealthService],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Received shutdown signal (${signal ?? 'none'}). Closing MongoDB connection gracefully...`,
    );
    try {
      await this.connection.close(false);
      this.logger.log('MongoDB connection closed successfully.');
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Error closing MongoDB connection during shutdown: ${error.message}`,
        error.stack,
      );
    }
  }
}
