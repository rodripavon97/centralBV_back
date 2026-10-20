import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { SupabaseHealthIndicator } from './supabase-health.indicator.js';

/**
 * Exposes liveness and readiness probes for the API.
 *
 * - `GET /api/health` — process is up (liveness).
 * - `GET /api/health/ready` — dependencies are reachable (readiness).
 */
@Controller('api/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly supabaseHealth: SupabaseHealthIndicator,
  ) {}

  /**
   * Liveness probe: confirms the NestJS process is running.
   *
   * @returns Health check result with overall status `ok` when the app is alive.
   */
  @Get()
  @HealthCheck()
  checkLive(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  /**
   * Readiness probe: verifies that required dependencies (Supabase) are available.
   *
   * @returns Health check result including the Supabase indicator status.
   */
  @Get('ready')
  @HealthCheck()
  checkReady(): Promise<HealthCheckResult> {
    return this.health.check([() => this.supabaseHealth.checkSupabase()]);
  }
}
