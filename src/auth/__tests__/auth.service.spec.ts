import 'reflect-metadata';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../users/domain/user.entity.js';
import { USER_REPOSITORY } from '../../users/domain/user.repository.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MailService } from '../../mail/mail.service.js';
import { AuthService } from '../auth.service.js';

describe('AuthService', () => {
  const jwtSecret = 'test-secret';
  const passwordResetUrl = 'http://localhost:5173/update-password';

  let authService: AuthService;
  let jwtService: JwtService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let getUser: ReturnType<typeof vi.fn>;
  let updateUserById: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let generateLink: ReturnType<typeof vi.fn>;
  let sendRecoveryEmail: ReturnType<typeof vi.fn>;
  let rolesEq: ReturnType<typeof vi.fn>;
  let validRecoveryToken: string;
  let passwordSessionToken: string;

  const activeUser = new User(
    'user-1',
    'admin@centralbv.com',
    'Admin',
    'CentralBV',
    true,
  );

  beforeEach(async () => {
    findByEmail = vi.fn();
    // Por defecto simulamos que la contraseña propuesta NO coincide con la
    // actual (login falla), para que el reset continúe con normalidad.
    signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    getUser = vi.fn();
    updateUserById = vi.fn();
    signOut = vi.fn().mockResolvedValue({ error: null });
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
            signOut,
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
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) =>
              key === 'PASSWORD_RESET_REDIRECT_URL' ? passwordResetUrl : undefined,
            ),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    jwtService = module.get(JwtService);

    validRecoveryToken = jwtService.sign({
      sub: activeUser.id,
      email: activeUser.email,
      amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }],
    });
    passwordSessionToken = jwtService.sign({
      sub: activeUser.id,
      email: activeUser.email,
      amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
    });
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
        token: validRecoveryToken,
        newPassword,
        confirmPassword: newPassword,
      });

      expect(getUser).toHaveBeenCalledWith(validRecoveryToken);
      expect(updateUserById).toHaveBeenCalledWith('user-1', {
        password: newPassword,
      });
      expect(signOut).toHaveBeenCalledWith(validRecoveryToken, 'global');
      expect(result).toEqual({
        message:
          'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
      });
    });

    it('rechaza un access token de login normal (amr password) aunque sea válido', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@centralbv.com' } },
        error: null,
      });

      await expect(
        authService.resetPassword({
          token: passwordSessionToken,
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.',
        ),
      );

      expect(updateUserById).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('no falla el reset si no se pueden revocar las sesiones', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@centralbv.com' } },
        error: null,
      });
      updateUserById.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      signOut.mockResolvedValue({ error: { message: 'Session not found' } });

      const result = await authService.resetPassword({
        token: validRecoveryToken,
        newPassword,
        confirmPassword: newPassword,
      });

      expect(updateUserById).toHaveBeenCalled();
      expect(signOut).toHaveBeenCalledWith(validRecoveryToken, 'global');
      expect(result).toEqual({
        message:
          'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
      });
    });

    it('devuelve un error si las contraseñas no coinciden', async () => {
      await expect(
        authService.resetPassword({
          token: validRecoveryToken,
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

    it('rechaza la nueva contraseña cuando es igual a la actual', async () => {
      getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@centralbv.com' } },
        error: null,
      });
      // El login con la contraseña propuesta funciona => es la misma que ya tenía.
      signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1' },
          session: { access_token: 'probe-session-token' },
        },
        error: null,
      });

      await expect(
        authService.resetPassword({
          token: validRecoveryToken,
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'La contraseña nueva no puede ser igual a la anterior. Por favor, ingresa otra contraseña.',
        ),
      );

      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@centralbv.com',
        password: newPassword,
      });
      // Solo se revoca la sesión de la comprobación, no las del usuario.
      expect(signOut).toHaveBeenCalledWith('probe-session-token', 'local');
      expect(signOut).not.toHaveBeenCalledWith(validRecoveryToken, 'global');
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('devuelve un error si la nueva contraseña es igual a la anterior (fallback de Supabase)', async () => {
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
          token: validRecoveryToken,
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'La contraseña nueva no puede ser igual a la anterior. Por favor, ingresa otra contraseña.',
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
          token: validRecoveryToken,
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toThrow(
        new BadRequestException('No se pudo actualizar la contraseña.'),
      );
    });
  });

  describe('forgotPassword', () => {
    const genericMessage =
      'Si el correo está registrado, recibirás un enlace en breve.';

    it('genera enlace y envía correo si el usuario existe y se genera el enlace correctamente', async () => {
      findByEmail.mockResolvedValue(activeUser);
      generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: `${passwordResetUrl}#access_token=xyz`,
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
          redirectTo: passwordResetUrl,
        },
      });
      expect(sendRecoveryEmail).toHaveBeenCalledWith(
        activeUser.email,
        activeUser.nombre,
        `${passwordResetUrl}#access_token=xyz`,
      );
      expect(result).toEqual({ message: genericMessage });
    });

    it('retorna mensaje genérico sin consultar Supabase si el usuario no existe', async () => {
      findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword({
        email: 'inexistente@centralbv.com',
      });

      expect(generateLink).not.toHaveBeenCalled();
      expect(sendRecoveryEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });

    it('retorna mensaje genérico sin enviar correo si Supabase no genera el enlace', async () => {
      findByEmail.mockResolvedValue(activeUser);
      generateLink.mockResolvedValue({
        data: { properties: {} },
        error: { message: 'User not found' },
      });

      const result = await authService.forgotPassword({
        email: activeUser.email,
      });

      expect(sendRecoveryEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });

    it('retorna mensaje genérico si el envío del correo falla', async () => {
      findByEmail.mockResolvedValue(activeUser);
      generateLink.mockResolvedValue({
        data: { properties: { action_link: `${passwordResetUrl}#access_token=xyz` } },
        error: null,
      });
      sendRecoveryEmail.mockRejectedValue(new Error('SMTP caído'));

      const result = await authService.forgotPassword({
        email: activeUser.email,
      });

      expect(result).toEqual({ message: genericMessage });
    });
  });
});
