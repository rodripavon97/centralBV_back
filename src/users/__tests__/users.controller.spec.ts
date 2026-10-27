import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller.js';
import { UsersService } from '../users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let getPendingUsers: ReturnType<typeof vi.fn>;
  let approveUser: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getPendingUsers = vi.fn().mockResolvedValue([]);
    approveUser = vi.fn().mockResolvedValue({ message: 'ok' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: { getPendingUsers, approveUser },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  it('getPending delega a getPendingUsers', async () => {
    await controller.getPending();
    expect(getPendingUsers).toHaveBeenCalled();
  });

  it('approve delega a approveUser', async () => {
    const id = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';
    await controller.approve(id);
    expect(approveUser).toHaveBeenCalledWith(id);
  });

  it('findAll retorna lista vacía (stub)', async () => {
    await expect(controller.findAll()).resolves.toEqual([]);
  });
});
