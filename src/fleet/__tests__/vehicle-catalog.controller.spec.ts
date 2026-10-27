import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { VehicleCatalogController } from '../vehicle-catalog.controller.js';
import { VehicleCatalogService } from '../vehicle-catalog.service.js';
import { CreateCatalogItemDto } from '../dtos/create-catalog-item.dto.js';
import { UpdateCatalogItemDto } from '../dtos/update-catalog-item.dto.js';
import { CreateCatalogModelDto } from '../dtos/create-catalog-model.dto.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';

describe('VehicleCatalogController', () => {
  let controller: VehicleCatalogController;
  let service: {
    findTypes: ReturnType<typeof vi.fn>;
    createType: ReturnType<typeof vi.fn>;
    updateType: ReturnType<typeof vi.fn>;
    deactivateType: ReturnType<typeof vi.fn>;
    findBrands: ReturnType<typeof vi.fn>;
    createBrand: ReturnType<typeof vi.fn>;
    updateBrand: ReturnType<typeof vi.fn>;
    deactivateBrand: ReturnType<typeof vi.fn>;
    findModels: ReturnType<typeof vi.fn>;
    createModel: ReturnType<typeof vi.fn>;
    updateModel: ReturnType<typeof vi.fn>;
    deactivateModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      findTypes: vi.fn(),
      createType: vi.fn(),
      updateType: vi.fn(),
      deactivateType: vi.fn(),
      findBrands: vi.fn(),
      createBrand: vi.fn(),
      updateBrand: vi.fn(),
      deactivateBrand: vi.fn(),
      findModels: vi.fn(),
      createModel: vi.fn(),
      updateModel: vi.fn(),
      deactivateModel: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleCatalogController],
      providers: [{ provide: VehicleCatalogService, useValue: service }],
    }).compile();
    controller = module.get(VehicleCatalogController);
  });

  describe('tipos', () => {
    it('findTypes delega', async () => {
      service.findTypes.mockResolvedValue([]);
      await controller.findTypes();
      expect(service.findTypes).toHaveBeenCalled();
    });

    it('createType pasa valor', async () => {
      const dto = Object.assign(new CreateCatalogItemDto(), {
        valor: 'Ambulancia',
      });
      service.createType.mockResolvedValue({ id: TIPO_ID, valor: 'Ambulancia' });
      await controller.createType(dto);
      expect(service.createType).toHaveBeenCalledWith('Ambulancia');
    });

    it('updateType pasa id y valor', async () => {
      const dto = Object.assign(new UpdateCatalogItemDto(), {
        valor: 'Motobomba',
      });
      service.updateType.mockResolvedValue({ id: TIPO_ID, valor: 'Motobomba' });
      await controller.updateType(TIPO_ID, dto);
      expect(service.updateType).toHaveBeenCalledWith(TIPO_ID, 'Motobomba');
    });

    it('deactivateType pasa id', async () => {
      service.deactivateType.mockResolvedValue(undefined);
      await controller.deactivateType(TIPO_ID);
      expect(service.deactivateType).toHaveBeenCalledWith(TIPO_ID);
    });
  });

  describe('marcas', () => {
    it('findBrands / createBrand / updateBrand / deactivateBrand delegan', async () => {
      service.findBrands.mockResolvedValue([]);
      service.createBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
      service.updateBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
      service.deactivateBrand.mockResolvedValue(undefined);

      await controller.findBrands();
      await controller.createBrand(
        Object.assign(new CreateCatalogItemDto(), { valor: 'Ford' }),
      );
      await controller.updateBrand(
        MARCA_ID,
        Object.assign(new UpdateCatalogItemDto(), { valor: 'Ford' }),
      );
      await controller.deactivateBrand(MARCA_ID);

      expect(service.findBrands).toHaveBeenCalled();
      expect(service.createBrand).toHaveBeenCalledWith('Ford');
      expect(service.updateBrand).toHaveBeenCalledWith(MARCA_ID, 'Ford');
      expect(service.deactivateBrand).toHaveBeenCalledWith(MARCA_ID);
    });
  });

  describe('modelos', () => {
    it('findModels / createModel / updateModel / deactivateModel delegan', async () => {
      service.findModels.mockResolvedValue([]);
      service.createModel.mockResolvedValue({
        id: MODELO_ID,
        valor: 'Ranger',
        marcaId: MARCA_ID,
      });
      service.updateModel.mockResolvedValue({
        id: MODELO_ID,
        valor: 'Ranger',
        marcaId: MARCA_ID,
      });
      service.deactivateModel.mockResolvedValue(undefined);

      await controller.findModels();
      await controller.createModel(
        Object.assign(new CreateCatalogModelDto(), {
          valor: 'Ranger',
          marcaId: MARCA_ID,
        }),
      );
      await controller.updateModel(
        MODELO_ID,
        Object.assign(new UpdateCatalogItemDto(), { valor: 'Ranger' }),
      );
      await controller.deactivateModel(MODELO_ID);

      expect(service.findModels).toHaveBeenCalled();
      expect(service.createModel).toHaveBeenCalledWith('Ranger', MARCA_ID);
      expect(service.updateModel).toHaveBeenCalledWith(MODELO_ID, 'Ranger');
      expect(service.deactivateModel).toHaveBeenCalledWith(MODELO_ID);
    });
  });
});
