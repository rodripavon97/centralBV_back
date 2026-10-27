import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../users/domain/user.entity.js';
import { USER_REPOSITORY } from '../../users/domain/user.repository.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { AuthService } from '../auth.service.js';

describe('AuthService', () => {
  const jwtSecret = 'test-secret';

  let authService: AuthService;
  let jwtService: JwtService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let rolesEq: ReturnType<typeof vi.fn>;

  const activeUser = new User(
    'user-1',
    'admin@centralbv.com',
    'Admin',
    'CentralBV',
    true,
  );

  beforeEach(async () => {
    findByEmail = vi.fn();
    signInWithPassword = vi.fn();
    rolesEq = vi.fn().mockResolvedValue({
      data: [{ roles: { nombre: 'ADMIN' } }],
    });

    const supabaseMock = {
      getClient: vi.fn().mockReturnValue({
        auth: { signInWithPassword },
      }),
      getAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ eq: rolesEq }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        { provide: USER_REPOSITORY, useValue: { findByEmail } },
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    authService = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  it('inicia sesión correctamente con credenciales válidas', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: activeUser.id } },
      error: null,
    });
    findByEmail.mockResolvedValue(activeUser);

    const result = await authService.login({
      email: activeUser.email,
      password: 'Admin123!',
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: activeUser.email,
      password: 'Admin123!',
    });
    expect(findByEmail).toHaveBeenCalledWith(activeUser.email);
    expect(result.user).toEqual({
      id: activeUser.id,
      nombre: activeUser.nombre,
      email: activeUser.email,
      roles: ['ADMIN'],
    });

    const payload = jwtService.verify(result.access_token);
    expect(payload).toMatchObject({
      sub: activeUser.id,
      email: activeUser.email,
      roles: ['ADMIN'],
    });
  });

  it('rechaza el ingreso cuando las credenciales son inválidas (email o contraseña incorrectos)', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      authService.login({
        email: activeUser.email,
        password: 'ContraseñaIncorrecta',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('rechaza el ingreso cuando Supabase no devuelve usuario', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      authService.login({
        email: activeUser.email,
        password: 'Admin123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el ingreso cuando el usuario no existe en la base de datos', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: activeUser.id } },
      error: null,
    });
    findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({
        email: activeUser.email,
        password: 'Admin123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el ingreso cuando la cuenta está desactivada', async () => {
    const inactiveUser = new User(
      'user-2',
      'inactivo@centralbv.com',
      'Inactivo',
      'CentralBV',
      false,
    );
    signInWithPassword.mockResolvedValue({
      data: { user: { id: inactiveUser.id } },
      error: null,
    });
    findByEmail.mockResolvedValue(inactiveUser);

    await expect(
      authService.login({
        email: inactiveUser.email,
        password: 'Admin123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
