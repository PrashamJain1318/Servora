import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, UsersModule, OrganizationsModule, MembershipsModule, HealthModule],
})
export class AppModule {}
