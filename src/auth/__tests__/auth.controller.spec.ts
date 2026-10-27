import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { LoginDto } from '../dtos/login.dto.js';

describe('AuthController', () => {
  let controller: AuthController;
  let login: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    login = vi.fn().mockResolvedValue({
      access_token: 'token',
      user: { id: 'u1', email: 'admin@centralbv.com' },
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login } }],
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
});
