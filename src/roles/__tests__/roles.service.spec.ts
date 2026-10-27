import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { RolesService } from '../roles.service.js';

describe('RolesService', () => {
  let service: RolesService;
  let from: ReturnType<typeof vi.fn>;

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
        RolesService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from }) },
        },
      ],
    }).compile();
    service = module.get(RolesService);
  });

  it('asigna un rol correctamente', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'usuarios') {
        return mockTerminal({ data: { id: 'u1' }, error: null });
      }
      if (table === 'roles') {
        return mockTerminal({ data: { id: 'r1' }, error: null });
      }
      return mockTerminal({ data: null, error: null });
    });

    await expect(service.assignRole('u1', 'r1')).resolves.toEqual({
      message: 'Rol asignado correctamente',
    });
  });

  it('falla si el usuario no existe', async () => {
    from.mockReturnValue(mockTerminal({ data: null, error: null }));
    await expect(service.assignRole('missing', 'r1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('falla si el rol no existe', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'usuarios') {
        return mockTerminal({ data: { id: 'u1' }, error: null });
      }
      return mockTerminal({ data: null, error: null });
    });
    await expect(service.assignRole('u1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('mapea duplicado 23505 a ConflictException', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'usuarios') {
        return mockTerminal({ data: { id: 'u1' }, error: null });
      }
      if (table === 'roles') {
        return mockTerminal({ data: { id: 'r1' }, error: null });
      }
      return mockTerminal({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      });
    });
    await expect(service.assignRole('u1', 'r1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('propaga otros errores de insert', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'usuarios') {
        return mockTerminal({ data: { id: 'u1' }, error: null });
      }
      if (table === 'roles') {
        return mockTerminal({ data: { id: 'r1' }, error: null });
      }
      return mockTerminal({
        data: null,
        error: { code: '42P01', message: 'relation missing' },
      });
    });
    await expect(service.assignRole('u1', 'r1')).rejects.toThrow(
      'relation missing',
    );
  });
});
