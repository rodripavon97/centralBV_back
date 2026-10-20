import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckAttempt, HealthIndicatorService } from '@nestjs/terminus';

/**
 * Terminus health indicator that checks Supabase Auth availability.
 *
 * Pings `{SUPABASE_URL}/auth/v1/health` with a 5s timeout.
 */
@Injectable()
export class SupabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs the Supabase Auth health check under the given indicator key.
   *
   * @param key - Name used in the Terminus health report (default: `'supabase'`).
   * @returns A health check attempt that resolves to `up` or `down`.
   */
  checkSupabase(key = 'supabase'): HealthCheckAttempt<string> {
    return this.healthIndicatorService
      .check(key)
      .attempt(async ({ signal }) => {
        const url = this.config.getOrThrow<string>('SUPABASE_URL');
        const anonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');

        const response = await fetch(`${url}/auth/v1/health`, {
          headers: { apikey: anonKey },
          signal,
        });

        if (!response.ok) {
          throw new Error(`Supabase health returned ${response.status}`);
        }
      })
      .withTimeout(5000);
  }
}
