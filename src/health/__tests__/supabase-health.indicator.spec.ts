import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { SupabaseHealthIndicator } from '../supabase-health.indicator.js';

describe('SupabaseHealthIndicator', () => {
  const getOrThrow = vi.fn((key: string) => {
    if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
    if (key === 'SUPABASE_ANON_KEY') return 'anon-key';
    throw new Error(`missing ${key}`);
  });

  const attempt = vi.fn();
  const withTimeout = vi.fn().mockReturnValue('attempt-result');
  const check = vi.fn().mockReturnValue({
    attempt: (fn: (ctx: { signal: AbortSignal }) => Promise<void>) => {
      attempt.mockImplementation(fn);
      return { withTimeout };
    },
  });

  let indicator: SupabaseHealthIndicator;

  beforeEach(() => {
    vi.clearAllMocks();
    withTimeout.mockReturnValue('attempt-result');
    check.mockReturnValue({
      attempt: (fn: (ctx: { signal: AbortSignal }) => Promise<void>) => {
        attempt.mockImplementation(fn);
        return { withTimeout };
      },
    });

    indicator = new SupabaseHealthIndicator(
      { check } as unknown as HealthIndicatorService,
      { getOrThrow } as unknown as ConfigService,
    );
  });

  it('marca up cuando el endpoint de health responde ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = indicator.checkSupabase();
    expect(result).toBe('attempt-result');
    expect(withTimeout).toHaveBeenCalledWith(5000);

    await attempt({ signal: AbortSignal.timeout(1000) });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/health',
      expect.objectContaining({
        headers: { apikey: 'anon-key' },
      }),
    );

    vi.unstubAllGlobals();
  });

  it('falla cuando el endpoint de health no responde ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    indicator.checkSupabase('supabase');
    await expect(
      attempt({ signal: AbortSignal.timeout(1000) }),
    ).rejects.toThrow('Supabase health returned 503');

    vi.unstubAllGlobals();
  });
});
