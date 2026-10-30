import 'reflect-metadata';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../users/domain/user.entity.js';
import { USER_REPOSITORY } from '../../users/domain/user.repository.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MailService } from '../../mail/mail.service.js';
import { AuthService } from '../auth.service.js';

describe('AuthService', () => {
  const jwtSecret = 'test-secret';

  let authService: AuthService;
  let jwtService: JwtService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let getUser: ReturnType<typeof vi.fn>;
  let updateUserById: ReturnType<typeof vi.fn>;
  let generateLink: ReturnType<typeof vi.fn>;
  let sendRecoveryEmail: ReturnType<typeof vi.fn>;
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
    getUser = vi.fn();
    updateUserById = vi.fn();
    generateLink = vi.fn();
    sendRecoveryEmail = vi.fn();
    rolesEq = vi.fn().mockResolvedValue({
      data: [{ roles: { nombre: 'ADMIN' } }],
    });

    const supabaseMock = {
      getClient: vi.fn().mockReturnValue({
        auth: {
          signInWithPassword,
          getUser,
        },
      }),
      getAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ eq: rolesEq }),
        }),
        auth: {
          admin: {
            updateUserById,
            generateLink,
          },
        },
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
        { provide: MailService, useValue: { sendRecoveryEmail } },
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

  describe('resetPassword', () => {
    const validToken = 'valid-jwt-token';
    const newPassword = 'Password123!';

    it('restablece la contraseña exitosamente cuando las contraseñas son iguales y el token es válido', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@centralbv.com' } },
        error: null,
      });
      updateUserById.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      const result = await authService.resetPassword({
        token: validToken,
        newPassword,
        confirmPassword: newPassword,
      });

      expect(getUser).toHaveBeenCalledWith(validToken);
      expect(updateUserById).toHaveBeenCalledWith('user-1', {
        password: newPassword,
      });
      expect(result).toEqual({
        message:
          'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
      });
    });

    it('devuelve un error si las contraseñas no coinciden', async () => {
      await expect(
        authService.resetPassword({
          token: validToken,
          newPassword: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Las contraseñas no coinciden. Por favor, verifícalas.',
        ),
      );

      expect(getUser).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('devuelve un error si el token venció o es inválido', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      await expect(
        authService.resetPassword({
          token: 'expired-token',
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.',
        ),
      );

      expect(getUser).toHaveBeenCalledWith('expired-token');
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('devuelve un error si el token es válido pero no se encuentra el usuario', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        authService.resetPassword({
          token: 'token-without-user',
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.',
        ),
      );

      expect(getUser).toHaveBeenCalledWith('token-without-user');
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('devuelve un error si la nueva contraseña es igual a la anterior', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'New password should be different from the old password.' },
      });

      await expect(
        authService.resetPassword({
          token: validToken,
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'La contraseña nueva no puede ser igual a la anterior.',
        ),
      );
    });

    it('devuelve un error genérico si falla la actualización en Supabase', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(
        authService.resetPassword({
          token: validToken,
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException('No se pudo actualizar la contraseña.'),
      );
    });
  });

  describe('forgotPassword', () => {
    it('genera enlace y envía correo si el usuario existe y se genera el enlace correctamente', async () => {
      findByEmail.mockResolvedValue(activeUser);
      generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: 'http://localhost:3000/update-password#access_token=xyz',
          },
        },
        error: null,
      });

      const result = await authService.forgotPassword({
        email: activeUser.email,
      });

      expect(findByEmail).toHaveBeenCalledWith(activeUser.email);
      expect(generateLink).toHaveBeenCalledWith({
        type: 'recovery',
        email: activeUser.email,
        options: {
          redirectTo: 'http://localhost:3000/update-password',
        },
      });
      expect(sendRecoveryEmail).toHaveBeenCalledWith(
        activeUser.email,
        activeUser.nombre,
        'http://localhost:3000/update-password#access_token=xyz',
      );
      expect(result).toEqual({
        message: 'Si el correo está registrado, recibirás un enlace en breve.',
      });
    });

    it('retorna mensaje genérico sin enviar correo si el usuario no existe', async () => {
      findByEmail.mockResolvedValue(null);
      generateLink.mockResolvedValue({
        data: { properties: { action_link: 'http://localhost:3000/test' } },
        error: null,
      });

      const result = await authService.forgotPassword({
        email: 'inexistente@centralbv.com',
      });

      expect(sendRecoveryEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Si el correo está registrado, recibirás un enlace en breve.',
      });
    });
  });
});
