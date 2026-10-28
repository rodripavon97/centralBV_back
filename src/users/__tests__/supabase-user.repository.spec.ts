import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { User } from '../domain/user.entity.js';

describe('SupabaseUserRepository', () => {
  let repo: SupabaseUserRepository;
  let from: ReturnType<typeof vi.fn>;

  const row = {
    id: 'u1',
    email: 'a@b.com',
    nombre: 'Ana',
    apellido: 'Lopez',
    activo: true,
    google_sub: null,
  };

  const mockTerminal = (resolved: unknown) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const self = new Proxy(chain, {
      get(target, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve);
        }
        if (!target[prop]) {
          target[prop] = vi.fn().mockReturnValue(self);
        }
        return target[prop];
      },
    });
    return self;
  };

  beforeEach(async () => {
    from = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseUserRepository,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from }) },
        },
      ],
    }).compile();
    repo = module.get(SupabaseUserRepository);
  });

  it('create inserta y mapea a User', async () => {
    from.mockReturnValue(mockTerminal({ data: row, error: null }));
    const user = await repo.create({
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      apellido: row.apellido,
      activo: true,
    });
    expect(user).toBeInstanceOf(User);
    expect(user.email).toBe(row.email);
  });

  it('create propaga errores de Supabase', async () => {
    from.mockReturnValue(
      mockTerminal({ data: null, error: { message: 'insert failed' } }),
    );
    await expect(repo.create({ email: 'x@y.com' })).rejects.toThrow(
      'insert failed',
    );
  });

  it('findByEmail retorna User o null', async () => {
    from.mockReturnValue(mockTerminal({ data: row, error: null }));
    await expect(repo.findByEmail(row.email)).resolves.toEqual(
      expect.objectContaining({ id: 'u1', email: row.email }),
    );

    from.mockReturnValue(mockTerminal({ data: null, error: null }));
    await expect(repo.findByEmail('missing@x.com')).resolves.toBeNull();
  });

  it('findById retorna User o null', async () => {
    from.mockReturnValue(mockTerminal({ data: row, error: null }));
    await expect(repo.findById('u1')).resolves.toEqual(
      expect.objectContaining({ id: 'u1' }),
    );

    from.mockReturnValue(mockTerminal({ data: null, error: null }));
    await expect(repo.findById('missing')).resolves.toBeNull();
  });
});
