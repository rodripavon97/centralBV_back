import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '../health.controller.js';
import { SupabaseHealthIndicator } from '../supabase-health.indicator.js';

describe('HealthController', () => {
  let controller: HealthController;
  let check: ReturnType<typeof vi.fn>;
  let checkSupabase: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    check = vi.fn().mockResolvedValue({ status: 'ok' });
    checkSupabase = vi.fn().mockResolvedValue({ supabase: { status: 'up' } });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check } },
        {
          provide: SupabaseHealthIndicator,
          useValue: { checkSupabase },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('checkLive ejecuta un health check vacío (liveness)', async () => {
    await controller.checkLive();
    expect(check).toHaveBeenCalledWith([]);
  });

  it('checkReady incluye el indicador de Supabase (readiness)', async () => {
    await controller.checkReady();
    expect(check).toHaveBeenCalledWith([expect.any(Function)]);
    const [indicators] = check.mock.calls[0];
    await indicators[0]();
    expect(checkSupabase).toHaveBeenCalled();
  });
});
