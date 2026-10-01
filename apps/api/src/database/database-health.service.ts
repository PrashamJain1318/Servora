import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type { DatabaseConnectionState } from './database.constants';

@Injectable()
export class DatabaseHealthService {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  /**
   * Returns the current connection state of the MongoDB database.
   */
  getConnectionState(): DatabaseConnectionState {
    if (!process.env['MONGODB_URI']) {
      return 'unconfigured';
    }

    switch (this.connection.readyState) {
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      case 3:
        return 'disconnecting';
      case 0:
      default:
        return 'disconnected';
    }
  }

  /**
   * Returns true if database is currently in readyState 1 (connected).
   */
  isConnected(): boolean {
    return this.connection.readyState === 1;
  }
}
