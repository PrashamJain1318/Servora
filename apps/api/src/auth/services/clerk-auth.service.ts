import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { verifyToken } from '@clerk/backend';
import type { AuthContext } from '@servora/types';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';

@Injectable()
export class ClerkAuthService {
  private readonly logger = new Logger(ClerkAuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  /**
   * Verifies the Clerk JWT token and resolves the matching Servora User document.
   */
  async verifyAndResolveUser(
    token: string,
  ): Promise<{ user: UserDocument; authContext: AuthContext }> {
    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    const secretKey = process.env['CLERK_SECRET_KEY'];

    let clerkUserId: string;

    try {
      if (secretKey) {
        // Production & real Clerk verification via official @clerk/backend verifyToken
        const verified = await verifyToken(token, {
          secretKey,
          jwtKey: process.env['CLERK_JWT_KEY'],
        });
        clerkUserId = verified.sub;
      } else {
        // Fallback for development / mock verification when secret key is unset
        // Allows testing without live network calls while still verifying token structure
        clerkUserId = this.extractTokenSubject(token);
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Clerk token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    if (!clerkUserId) {
      throw new UnauthorizedException('Token does not contain a valid subject claim');
    }

    // Resolve corresponding Servora User from MongoDB
    const user = await this.userModel.findOne({
      externalAuthId: clerkUserId,
      isActive: { $ne: false },
    });

    if (!user) {
      this.logger.warn(`Servora User not found or deactivated for externalAuthId: ${clerkUserId}`);
      throw new UnauthorizedException('Authenticated user not found or deactivated in Servora');
    }

    const authContext: AuthContext = {
      userId: user._id.toString(),
      externalAuthId: user.externalAuthId ?? clerkUserId,
      email: user.email,
      globalRole: user.globalRole,
    };

    return { user, authContext };
  }

  /**
   * Safe subject extractor for test environments or development mocks.
   */
  private extractTokenSubject(token: string): string {
    try {
      const parts = token.split('.');
      if (parts.length === 3 && parts[1]) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload && payload.sub) {
          return payload.sub;
        }
      }
    } catch {
      // Fall through to error
    }
    throw new UnauthorizedException('Malformed token');
  }
}
