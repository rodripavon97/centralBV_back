import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SupabaseModule } from './supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.modules.js';
import { SeedModule } from './seed/seed.module.js';
import { HealthModule } from './health/health.module.js';
import { CertificateRequestModule } from './certificates/certificate-request.module.js';
import { FleetModule } from './fleet/fleet.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite global por IP; los endpoints sensibles lo sobreescriben con @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    SeedModule,
    CertificateRequestModule,
    FleetModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
