import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { SupabaseHealthIndicator } from './supabase-health.indicator.js';

/**
 * NestJS module that wires Terminus health checks and the Supabase indicator.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [SupabaseHealthIndicator],
})
export class HealthModule {}
