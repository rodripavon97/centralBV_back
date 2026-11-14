import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { CompartmentController } from '../compartment.controller.js';
import { CompartmentService } from '../compartment.service.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { GenerateCompartmentsDto } from '../dtos/generate-compartments.dto.js';
import { CreateCompartmentDto } from '../dtos/create-compartment.dto.js';
import { UpdateCompartmentDto } from '../dtos/update-compartment.dto.js';
import { UpdateCompartmentStatusDto } from '../dtos/update-compartment-status.dto.js';

const ID = '44444444-4444-4444-8444-444444444444';
const CID = '88888888-8888-4888-8888-888888888881';

describe('CompartmentController', () => {
  let controller: CompartmentController;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    service = {
      list: vi.fn(),
      generate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      setStatus: vi.fn(),
      remove: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompartmentController],
      providers: [{ provide: CompartmentService, useValue: service }],
    }).compile();
    controller = module.get(CompartmentController);
  });

  const rolesOf = (method: keyof CompartmentController) =>
    Reflect.getMetadata(ROLES_KEY, CompartmentController.prototype[method]) as
      string[] | undefined;

  it('configurar es para AUTOMOTORES (ADMIN pasa por el guard)', () => {
    expect(rolesOf('generate')).toEqual(['AUTOMOTORES']);
    expect(rolesOf('create')).toEqual(['AUTOMOTORES']);
    expect(rolesOf('update')).toEqual(['AUTOMOTORES']);
    expect(rolesOf('remove')).toEqual(['AUTOMOTORES']);
  });

  it('ver y cambiar el estado no piden rol', () => {
    expect(rolesOf('list')).toBeUndefined();
    expect(rolesOf('setStatus')).toBeUndefined();
  });

  it('delega en el servicio', async () => {
    const gen = new GenerateCompartmentsDto();
    const create = new CreateCompartmentDto();
    const update = new UpdateCompartmentDto();
    const status = Object.assign(new UpdateCompartmentStatusDto(), {
      estado: 'OBSERVACIONES',
    });

    await controller.list(ID);
    await controller.generate(ID, gen);
    await controller.create(ID, create);
    await controller.update(ID, CID, update);
    await controller.setStatus(ID, CID, status);
    await controller.remove(ID, CID);

    expect(service.list).toHaveBeenCalledWith(ID);
    expect(service.generate).toHaveBeenCalledWith(ID, gen);
    expect(service.create).toHaveBeenCalledWith(ID, create);
    expect(service.update).toHaveBeenCalledWith(ID, CID, update);
    expect(service.setStatus).toHaveBeenCalledWith(ID, CID, 'OBSERVACIONES');
    expect(service.remove).toHaveBeenCalledWith(ID, CID);
  });
});
