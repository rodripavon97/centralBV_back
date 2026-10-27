import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FleetController } from '../fleet.controller.js';
import { FleetService } from '../fleet.service.js';
import { CreateEmergencyVehicleDto } from '../dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from '../dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from '../dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from '../dtos/write-off-emergency-vehicle.dto.js';

const ID = '44444444-4444-4444-8444-444444444444';

describe('FleetController', () => {
  let controller: FleetController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    writeOff: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      writeOff: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FleetController],
      providers: [{ provide: FleetService, useValue: service }],
    }).compile();
    controller = module.get(FleetController);
  });

  it('list delegates to findAll', async () => {
    const query = new ListEmergencyVehiclesDto();
    service.findAll.mockResolvedValue({ items: [], total: 0 });
    await controller.list(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('getById delegates to findById', async () => {
    service.findById.mockResolvedValue({ id: ID });
    await controller.getById(ID);
    expect(service.findById).toHaveBeenCalledWith(ID);
  });

  it('create delegates to create', async () => {
    const dto = new CreateEmergencyVehicleDto();
    service.create.mockResolvedValue({ id: ID });
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('update delegates to update', async () => {
    const dto = new UpdateEmergencyVehicleDto();
    service.update.mockResolvedValue({ id: ID });
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('writeOff delegates to writeOff', async () => {
    const dto = new WriteOffEmergencyVehicleDto();
    service.writeOff.mockResolvedValue({ id: ID });
    await controller.writeOff(ID, dto);
    expect(service.writeOff).toHaveBeenCalledWith(ID, dto);
  });
});
