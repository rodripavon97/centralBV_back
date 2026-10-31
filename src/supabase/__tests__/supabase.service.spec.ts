import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase.service.js';

describe('SupabaseService', () => {
  it('inicializa clientes anon y admin y los expone', () => {
    const getOrThrow = vi.fn((key: string) => {
      const values: Record<string, string> = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      };
      return values[key];
    });

    const service = new SupabaseService({
      getOrThrow,
    } as unknown as ConfigService);

    service.onModuleInit();

    expect(getOrThrow).toHaveBeenCalledWith('SUPABASE_URL');
    expect(getOrThrow).toHaveBeenCalledWith('SUPABASE_ANON_KEY');
    expect(getOrThrow).toHaveBeenCalledWith('SUPABASE_SERVICE_ROLE_KEY');
    expect(service.getClient()).toBeTruthy();
    expect(service.getAdminClient()).toBeTruthy();
    expect(service.getClient()).not.toBe(service.getAdminClient());
  });
});
