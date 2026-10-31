import 'reflect-metadata';
import {
  BadRequestException,
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
import { EditUserDto } from '../dtos/edit-user.dto.js';
import { EncryptionService } from '../../common/security/encryption.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let findById: ReturnType<typeof vi.fn>;
  let findAll: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let createUser: ReturnType<typeof vi.fn>;
  let updateUserById: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let sendWelcomeEmail: ReturnType<typeof vi.fn>;
  let encrypt: ReturnType<typeof vi.fn>;
  let decrypt: ReturnType<typeof vi.fn>;

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
    update = vi.fn().mockResolvedValue(undefined);
    createUser = vi.fn();
    updateUserById = vi.fn().mockResolvedValue({ data: null, error: null });
    from = vi.fn();
    sendWelcomeEmail = vi.fn().mockResolvedValue(undefined);
    encrypt = vi.fn().mockImplementation((value: string) => `v1.enc(${value})`);
    decrypt = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USER_REPOSITORY,
          useValue: { findByEmail, findById, create, update, findAll },
        },
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: () => ({
              auth: { admin: { createUser, updateUserById } },
              from,
            }),
          },
        },
        {
          provide: MailService,
          useValue: { sendWelcomeEmail },
        },
        {
          provide: EncryptionService,
          useValue: { encrypt, decrypt },
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
        message:
          'Usuario creado exitosamente. Se ha enviado un correo con las credenciales.',
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

    it('guarda la contraseña cifrada para poder reenviarla luego', async () => {
      await service.createUser(dto);

      expect(encrypt).toHaveBeenCalledWith(dto.password);
      expect(from).toHaveBeenCalledWith('usuarios');
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

      const insertSpy = vi
        .fn()
        .mockReturnValue(mockChain({ data: null, error: null }));

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
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── EDICIÓN DE USUARIO ───────────────────────────────────────

  describe('updateUser', () => {
    const current = new User(
      'u1',
      'ana@centralbv.com',
      'Ana',
      'Lopez',
      true,
      undefined,
      ['COMUN'],
    );

    beforeEach(() => {
      update.mockResolvedValue(current);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      findById.mockResolvedValue(null);

      await expect(
        service.updateUser('missing', EditUserDto.fromDto({ nombre: 'Ana' })),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it('actualiza solamente los campos enviados', async () => {
      const updated = new User(
        'u1',
        'ana@centralbv.com',
        'Ana María',
        'Lopez',
        true,
        undefined,
        ['COMUN'],
      );
      findById.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
      update.mockResolvedValue(updated);

      const result = await service.updateUser(
        current.id,
        EditUserDto.fromDto({ nombre: 'Ana María' }),
      );

      expect(update).toHaveBeenCalledWith(current.id, { nombre: 'Ana María' });
      expect(result).toBe(updated);
    });

    it('no modifica la contraseña aunque venga en el payload', async () => {
      findById.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
      const dto = EditUserDto.fromDto({
        nombre: 'Ana',
        password: 'Nueva123!',
      } as unknown as Partial<EditUserDto>);

      await service.updateUser(current.id, dto);

      expect(encrypt).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(current.id, { nombre: 'Ana' });
      expect(update.mock.calls[0][1]).not.toHaveProperty('password');
    });

    it('sincroniza el email con Supabase Auth cuando cambia', async () => {
      const updated = new User(
        'u1',
        'nueva@centralbv.com',
        'Ana',
        'Lopez',
        true,
        undefined,
        ['COMUN'],
      );
      findById.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
      findByEmail.mockResolvedValue(null);
      updateUserById.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      update.mockResolvedValue(updated);

      const result = await service.updateUser(
        current.id,
        EditUserDto.fromDto({ email: 'nueva@centralbv.com' }),
      );

      expect(updateUserById).toHaveBeenCalledWith('u1', {
        email: 'nueva@centralbv.com',
        email_confirm: true,
      });
      expect(update).toHaveBeenCalledWith('u1', {
        email: 'nueva@centralbv.com',
      });
      expect(result).toBe(updated);
    });

    it('no toca Supabase Auth si el email no cambia', async () => {
      findById.mockResolvedValue(current);

      await service.updateUser(
        current.id,
        EditUserDto.fromDto({ email: current.email }),
      );

      expect(findByEmail).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el email pertenece a otro usuario', async () => {
      findById.mockResolvedValue(current);
      findByEmail.mockResolvedValue(
        new User('u2', 'ocupado@centralbv.com', 'Otro', 'User', true),
      );

      await expect(
        service.updateUser(
          current.id,
          EditUserDto.fromDto({ email: 'ocupado@centralbv.com' }),
        ),
      ).rejects.toThrow(ConflictException);

      expect(updateUserById).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('reemplaza el rol y aplica la herencia ADMINISTRATIVO → COMUN', async () => {
      const updated = new User(
        'u1',
        current.email,
        current.nombre,
        current.apellido,
        true,
        undefined,
        ['ADMINISTRATIVO', 'COMUN'],
      );
      findById.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);

      const insertSpy = vi
        .fn()
        .mockReturnValue(mockChain({ data: null, error: null }));
      const deleteEq = vi
        .fn()
        .mockReturnValue(mockChain({ data: null, error: null }));

      from.mockImplementation((table: string) => {
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, val: string) =>
                mockChain({
                  data: { id: `role-${val.toLowerCase()}` },
                  error: null,
                }),
              ),
            }),
          };
        }
        if (table === 'usuario_rol') {
          return {
            delete: vi.fn().mockReturnValue({ eq: deleteEq }),
            insert: insertSpy,
          };
        }
        return mockChain({ data: null, error: null });
      });

      const result = await service.updateUser(
        current.id,
        EditUserDto.fromDto({ roleName: 'administrativo' }),
      );

      expect(deleteEq).toHaveBeenCalledWith('usuario_id', current.id);
      expect(insertSpy).toHaveBeenCalledWith([
        { usuario_id: current.id, rol_id: 'role-administrativo' },
        { usuario_id: current.id, rol_id: 'role-comun' },
      ]);
      expect(result).toBe(updated);
    });

    it('lanza NotFoundException si el rol nuevo no existe', async () => {
      findById.mockResolvedValue(current);
      from.mockImplementation(() =>
        mockChain({ data: null, error: { message: 'not found' } }),
      );

      await expect(
        service.updateUser(
          current.id,
          EditUserDto.fromDto({ roleName: 'inexistente' }),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });
  });

  // ─── REENVÍO DE BIENVENIDA ────────────────────────────────────

  describe('resendWelcomeEmail', () => {
    const user = new User(
      '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
      'ana@centralbv.com',
      'Ana',
      'Lopez',
      true,
    );
    const encryptedPassword = 'v1.iv.tag.data';
    const originalPassword = 'Temporal123!';

    beforeEach(() => {
      findById.mockResolvedValue(user);
      from.mockImplementation((table: string) => {
        if (table === 'usuarios') {
          return mockChain({
            data: { password_cifrada: encryptedPassword },
            error: null,
          });
        }
        return mockChain({ data: null, error: null });
      });
      decrypt.mockReturnValue(originalPassword);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      findById.mockResolvedValue(null);

      await expect(service.resendWelcomeEmail(user.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('reenvía la misma contraseña que el admin ingresó al registrar', async () => {
      const result = await service.resendWelcomeEmail(user.id);

      expect(decrypt).toHaveBeenCalledWith(encryptedPassword);
      expect(sendWelcomeEmail).toHaveBeenCalledWith(
        user.email,
        user.nombre,
        originalPassword,
      );
      expect(updateUserById).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Correo de bienvenida reenviado exitosamente.',
      });
    });

    it('lanza BadRequestException si no hay contraseña guardada (usuario viejo)', async () => {
      from.mockImplementation(() =>
        mockChain({ data: { password_cifrada: null }, error: null }),
      );

      await expect(service.resendWelcomeEmail(user.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(updateUserById).not.toHaveBeenCalled();
      expect(sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el descifrado falla, sin generar una nueva', async () => {
      decrypt.mockImplementation(() => {
        throw new Error('bad payload');
      });

      await expect(service.resendWelcomeEmail(user.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(updateUserById).not.toHaveBeenCalled();
      expect(sendWelcomeEmail).not.toHaveBeenCalled();
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
