import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { LoginDto } from '../dtos/login.dto.js';
import { ForgotPasswordDto } from '../dtos/forgotPassword.dto.js';
import { ResetPasswordDto } from '../dtos/resetPassword.dto.js';

describe('AuthController', () => {
  let controller: AuthController;
  let login: ReturnType<typeof vi.fn>;
  let forgotPassword: ReturnType<typeof vi.fn>;
  let resetPassword: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    login = vi.fn().mockResolvedValue({
      access_token: 'token',
      user: { id: 'u1', email: 'admin@centralbv.com' },
    });
    forgotPassword = vi.fn().mockResolvedValue({
      message: 'Si el correo está registrado, recibirás un enlace en breve.',
    });
    resetPassword = vi.fn().mockResolvedValue({
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login, forgotPassword, resetPassword },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('delega el login al AuthService', async () => {
    const dto = Object.assign(new LoginDto(), {
      email: 'admin@centralbv.com',
      password: 'Admin123!',
    });

    const result = await controller.login(dto);

    expect(login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(
      expect.objectContaining({ access_token: 'token' }),
    );
  });

  it('delega forgotPassword al AuthService', async () => {
    const dto = Object.assign(new ForgotPasswordDto(), {
      email: 'admin@centralbv.com',
    });

    const result = await controller.forgotPassword(dto);

    expect(forgotPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      message: 'Si el correo está registrado, recibirás un enlace en breve.',
    });
  });

  it('delega resetPassword al AuthService', async () => {
    const dto = Object.assign(new ResetPasswordDto(), {
      token: 'jwt-token-123',
      newPassword: 'Password123!',
      confirmPassword: 'Password123!',
    });

    const result = await controller.resetPassword(dto);

    expect(resetPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
    });
  });
});

