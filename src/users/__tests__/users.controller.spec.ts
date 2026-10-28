import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller.js';
import { UsersService } from '../users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let createUserFn: ReturnType<typeof vi.fn>;
  let findAllFn: ReturnType<typeof vi.fn>;
  let findOneFn: ReturnType<typeof vi.fn>;
  let resendWelcomeEmailFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createUserFn = vi.fn().mockResolvedValue({
      message: 'Usuario creado exitosamente. Se ha enviado un correo con las credenciales.',
      userId: 'user-new',
    });
    findAllFn = vi.fn().mockResolvedValue({ data: [], total: 0, pagina: 1, porPagina: 10 });
    findOneFn = vi.fn().mockResolvedValue({ id: 'u1', nombre: 'Ana' });
    resendWelcomeEmailFn = vi.fn().mockResolvedValue({
      message: 'Correo de bienvenida reenviado exitosamente.',
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            createUser: createUserFn,
            findAll: findAllFn,
            findOne: findOneFn,
            resendWelcomeEmail: resendWelcomeEmailFn,
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  it('create delega a usersService.createUser', async () => {
    const dto = {
      nombre: 'Ana',
      apellido: 'Lopez',
      email: 'ana@centralbv.com',
      password: 'Segura12x',
      roleName: 'comun',
    } as any;

    const result = await controller.create(dto);

    expect(createUserFn).toHaveBeenCalledWith(dto);
    expect(result).toHaveProperty('userId');
  });

  it('findAll delega a usersService.findAll', async () => {
    const query = { pagina: 1, porPagina: 10 } as any;
    await controller.findAll(query);
    expect(findAllFn).toHaveBeenCalledWith(query);
  });

  it('findOne delega a usersService.findOne', async () => {
    const id = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';
    await controller.findOne(id);
    expect(findOneFn).toHaveBeenCalledWith(id);
  });

  it('resendWelcomeEmail delega a usersService.resendWelcomeEmail', async () => {
    const id = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

    const result = await controller.resendWelcomeEmail(id);

    expect(resendWelcomeEmailFn).toHaveBeenCalledWith(id);
    expect(result).toHaveProperty('message');
  });
});
