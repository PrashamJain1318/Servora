import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../modules/users/schemas/user.schema';
import { Membership, MembershipSchema } from '../modules/memberships/schemas/membership.schema';
import { ClerkAuthService } from './services/clerk-auth.service';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { OrganizationGuard } from './guards/organization.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [ClerkAuthService, ClerkAuthGuard, OrganizationGuard, RolesGuard, TenantInterceptor],
  exports: [ClerkAuthService, ClerkAuthGuard, OrganizationGuard, RolesGuard, TenantInterceptor],
})
export class AuthModule {}
