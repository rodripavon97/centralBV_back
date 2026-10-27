import 'reflect-metadata';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../domain/user.entity.js';
import { USER_REPOSITORY } from '../domain/user.repository.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { UsersService } from '../users.service.js';
import { CreateUserDto } from '../dtos/create-user.dto.js';

describe('UsersService', () => {
  let service: UsersService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let findById: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let createUser: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  const dto = Object.assign(new CreateUserDto(), {
    nombre: 'Juan',
    apellido: 'Perez',
    email: 'juan@centralbv.com',
    password: 'Temporal123!',
    roleName: 'ADMINISTRATIVO',
  });

  const mockChain = (resolved: unknown) => {
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
    findByEmail = vi.fn();
    findById = vi.fn();
    create = vi.fn().mockResolvedValue(undefined);
    createUser = vi.fn();
    from = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USER_REPOSITORY,
          useValue: { findByEmail, findById, create },
        },
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: () => ({
              auth: { admin: { createUser } },
              from,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('createUser', () => {
    it('rechaza si el email ya existe', async () => {
      findByEmail.mockResolvedValue(
        new User('u1', dto.email, 'Juan', 'Perez', true),
      );
      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
      expect(createUser).not.toHaveBeenCalled();
    });

    it('crea usuario, asigna rol y retorna mensaje de éxito', async () => {
      findByEmail.mockResolvedValue(null);
      createUser.mockResolvedValue({
        data: { user: { id: 'user-new' } },
        error: null,
      });
      from.mockImplementation((table: string) => {
        if (table === 'roles') {
          return mockChain({ data: { id: 'role-1' }, error: null });
        }
        if (table === 'usuario_rol') {
          return mockChain({ data: null, error: null });
        }
        return mockChain({ data: null, error: null });
      });

      const result = await service.createUser(dto);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-new',
          email: dto.email,
          activo: true,
        }),
      );
      expect(result).toEqual({
        message: 'Usuario creado exitosamente y correo de bienvenida enviado',
        userId: 'user-new',
      });
    });

    it('falla si Supabase Auth no puede crear credenciales', async () => {
      findByEmail.mockResolvedValue(null);
      createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'weak password' },
      });

      await expect(service.createUser(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('falla si el rol no existe', async () => {
      findByEmail.mockResolvedValue(null);
      createUser.mockResolvedValue({
        data: { user: { id: 'user-new' } },
        error: null,
      });
      from.mockImplementation(() =>
        mockChain({ data: null, error: { message: 'not found' } }),
      );

      await expect(service.createUser(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPendingUsers', () => {
    it('lista usuarios inactivos', async () => {
      const pending = [{ id: 'u1', activo: false }];
      from.mockReturnValue(mockChain({ data: pending, error: null }));

      await expect(service.getPendingUsers()).resolves.toEqual(pending);
    });

    it('propaga errores de Supabase', async () => {
      from.mockReturnValue(
        mockChain({ data: null, error: { message: 'db down' } }),
      );
      await expect(service.getPendingUsers()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('approveUser', () => {
    it('aprueba un usuario existente', async () => {
      findById.mockResolvedValue(
        new User('u1', 'a@b.com', 'A', 'B', false),
      );
      from.mockReturnValue(
        mockChain({
          data: { id: 'u1', activo: true },
          error: null,
        }),
      );

      const result = await service.approveUser('u1');
      expect(result.message).toBe('Usuario aprobado exitosamente');
      expect(result.user).toEqual({ id: 'u1', activo: true });
    });

    it('retorna 404 si el usuario no existe', async () => {
      findById.mockResolvedValue(null);
      await expect(service.approveUser('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
