import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from '../roles.controller.js';
import { RolesService } from '../roles.service.js';
import { AssignRoleDto } from '../dtos/assing-roles.dtos.js';

describe('RolesController', () => {
  let controller: RolesController;
  let assignRole: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    assignRole = vi.fn().mockResolvedValue({ message: 'ok' });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: RolesService, useValue: { assignRole } }],
    }).compile();
    controller = module.get(RolesController);
  });

  it('assign delega a assignRole con usuario_id y rol_id', async () => {
    const dto = Object.assign(new AssignRoleDto(), {
      usuario_id: '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
      rol_id: '8c1f2d3e-5b6e-4f7a-9b0c-1d2e3f4a5b6c',
    });
    await controller.assign(dto);
    expect(assignRole).toHaveBeenCalledWith(dto.usuario_id, dto.rol_id);
  });
});
