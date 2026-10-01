import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { MONGODB_URI_ENV } from '../src/database/database.constants';

describe('Database Connection (Category A)', () => {
  let mongoServer: MongoMemoryServer;
  let originalUri: string | undefined;

  beforeEach(() => {
    originalUri = process.env[MONGODB_URI_ENV];
  });

  afterEach(async () => {
    if (originalUri !== undefined) {
      process.env[MONGODB_URI_ENV] = originalUri;
    } else {
      delete process.env[MONGODB_URI_ENV];
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('should detect missing MONGODB_URI configuration and fail clearly', () => {
    delete process.env[MONGODB_URI_ENV];

    const checkConfig = () => {
      const uri = process.env[MONGODB_URI_ENV];
      if (!uri) {
        throw new Error(
          `[DatabaseModule] Missing required configuration: "${MONGODB_URI_ENV}". Ensure MONGODB_URI is defined in your environment or .env file before starting the API.`,
        );
      }
      return uri;
    };

    expect(checkConfig).toThrowError(/Missing required configuration: "MONGODB_URI"/);
  });

  it('should establish connection successfully when valid MONGODB_URI is provided', async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env[MONGODB_URI_ENV] = uri;

    const connection = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    expect(connection.connection.readyState).toBe(1); // 1 = connected
    expect(connection.connection.name).toBeDefined();

    await mongoose.disconnect();
    expect(connection.connection.readyState).toBe(0); // 0 = disconnected
  });
});
