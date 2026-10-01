/**
 * Database constants and tokens
 */

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const MONGODB_URI_ENV = 'MONGODB_URI';

export type DatabaseConnectionState =
  'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unconfigured';
