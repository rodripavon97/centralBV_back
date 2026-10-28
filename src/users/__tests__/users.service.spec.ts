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
import { MailService } from '../../mail/mail.service.js';
import { UsersService } from '../users.service.js';
import { CreateUserDto } from '../dtos/create-user.dto.js';

describe('UsersService', () => {
  let service: UsersService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let findById: ReturnType<typeof vi.fn>;
  let findAll: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let createUser: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let sendWelcomeEmail: ReturnType<typeof vi.fn>;

  const dto = Object.assign(new CreateUserDto(), {
    nombre: 'Juan',
    apellido: 'Perez',
    email: 'juan@centralbv.com',
    password: 'Temporal123!',
    roleName: 'administrativo',
  });

  /** Helper para crear un chain builder de Supabase (select().eq().single(), etc.) */
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
    findAll = vi.fn();
    create = vi.fn().mockResolvedValue(undefined);
    createUser = vi.fn();
    from = vi.fn();
    sendWelcomeEmail = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USER_REPOSITORY,
          useValue: { findByEmail, findById, create, findAll },
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
        {
          provide: MailService,
          useValue: { sendWelcomeEmail },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  // ─── EMAIL DUPLICADO ─────────────────────────────────────────

  describe('email duplicado', () => {
    it('lanza ConflictException si el email ya existe en el sistema', async () => {
      findByEmail.mockResolvedValue(
        new User('u1', dto.email, 'Juan', 'Perez', true),
      );
      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
    });

    it('no intenta crear credenciales en Supabase si el email ya existe', async () => {
      findByEmail.mockResolvedValue(
        new User('u1', dto.email, 'Juan', 'Perez', true),
      );
      await expect(service.createUser(dto)).rejects.toThrow();
      expect(createUser).not.toHaveBeenCalled();
    });
  });

  // ─── CREACIÓN EXITOSA ─────────────────────────────────────────

  describe('creación exitosa', () => {
    beforeEach(() => {
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
    });

    it('crea el usuario en el repositorio con los datos correctos', async () => {
      await service.createUser(dto);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-new',
          email: dto.email,
          nombre: dto.nombre,
          apellido: dto.apellido,
          activo: true,
        }),
      );
    });

    it('retorna mensaje de éxito y el userId', async () => {
      const result = await service.createUser(dto);

      expect(result).toEqual({
        message: 'Usuario creado exitosamente. Se ha enviado un correo con las credenciales.',
        userId: 'user-new',
      });
    });

    it('envía el correo de bienvenida con email, nombre y contraseña temporal', async () => {
      await service.createUser(dto);

      expect(sendWelcomeEmail).toHaveBeenCalledWith(
        dto.email,
        dto.nombre,
        dto.password,
      );
    });

    it('envía el correo exactamente una vez', async () => {
      await service.createUser(dto);
      expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    });
  });

  // ─── HERENCIA DE ROLES ────────────────────────────────────────

  describe('herencia de roles', () => {
    it('asigna también el rol COMUN cuando el rol es ADMINISTRATIVO', async () => {
      findByEmail.mockResolvedValue(null);
      createUser.mockResolvedValue({
        data: { user: { id: 'user-adm' } },
        error: null,
      });

      const insertSpy = vi.fn().mockReturnValue(
        mockChain({ data: null, error: null }),
      );

      from.mockImplementation((table: string) => {
        if (table === 'roles') {
          const selectCalls: string[] = [];
          return {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((_col: string, val: string) => {
                selectCalls.push(val);
                if (val === 'ADMINISTRATIVO') {
                  return mockChain({ data: { id: 'role-admin' }, error: null });
                }
                if (val === 'COMUN') {
                  return mockChain({ data: { id: 'role-comun' }, error: null });
                }
                return mockChain({ data: null, error: null });
              }),
            })),
          };
        }
        if (table === 'usuario_rol') {
          return { insert: insertSpy };
        }
        return mockChain({ data: null, error: null });
      });

      await service.createUser(dto);

      expect(insertSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          { usuario_id: 'user-adm', rol_id: 'role-admin' },
          { usuario_id: 'user-adm', rol_id: 'role-comun' },
        ]),
      );
    });
  });

  // ─── ERRORES DE SUPABASE AUTH ─────────────────────────────────

  describe('errores de Supabase Auth', () => {
    it('lanza InternalServerErrorException si Supabase Auth falla', async () => {
      findByEmail.mockResolvedValue(null);
      createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'weak password' },
      });

      await expect(service.createUser(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── ROL INEXISTENTE ──────────────────────────────────────────

  describe('rol inexistente', () => {
    it('lanza NotFoundException si el rol no existe en la base de datos', async () => {
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

  // ─── FIND ONE ─────────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna el usuario si existe', async () => {
      const user = new User('u1', 'a@b.com', 'Ana', 'Lopez', true);
      findById.mockResolvedValue(user);
      await expect(service.findOne('u1')).resolves.toEqual(user);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── FIND ALL ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('retorna la lista paginada de usuarios', async () => {
      findAll.mockResolvedValue({ items: [], total: 0 });
      const result = await service.findAll({ pagina: 1, porPagina: 10 } as any);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('pagina');
      expect(result).toHaveProperty('paginas');
      expect(result).toHaveProperty('porPagina');
    });
  });
});
