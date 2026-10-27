import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { CreateEmergencyVehicleDto } from '../dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from '../dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from '../dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from '../dtos/write-off-emergency-vehicle.dto.js';
import { CreateCatalogItemDto } from '../dtos/create-catalog-item.dto.js';
import { UpdateCatalogItemDto } from '../dtos/update-catalog-item.dto.js';
import { CreateCatalogModelDto } from '../dtos/create-catalog-model.dto.js';
import { ACTIVE_VEHICLE_STATUSES } from '../domain/emergency-vehicle.enums.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';

const propertiesWithError = (
  errors: ValidationError[],
  prefix = '',
): string[] =>
  errors.flatMap((e) =>
    e.children?.length
      ? propertiesWithError(e.children, `${prefix}${e.property}.`)
      : [`${prefix}${e.property}`],
  );

const validateDto = async <T extends object>(Cls: new () => T, data: unknown) => {
  const dto = plainToInstance(Cls, data);
  return {
    dto,
    errors: propertiesWithError(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ),
  };
};

const validVehicleBody = () => ({
  patente: 'AB123CD',
  denominacion: 'Unidad 1',
  tipoId: TIPO_ID,
  marcaId: MARCA_ID,
  modeloId: MODELO_ID,
});

describe('CreateEmergencyVehicleDto', () => {
  it('acepta un body completo y trimmea strings', async () => {
    const { dto, errors } = await validateDto(CreateEmergencyVehicleDto, {
      patente: '  AB123CD  ',
      denominacion: '  Unidad 1  ',
      tipoId: TIPO_ID,
      marcaId: MARCA_ID,
      modeloId: MODELO_ID,
    });
    expect(errors).toEqual([]);
    expect(dto.patente).toBe('AB123CD');
    expect(dto.denominacion).toBe('Unidad 1');
    expect(dto.tipoId).toBe(TIPO_ID);
  });

  it('requiere campos obligatorios', async () => {
    const { errors } = await validateDto(CreateEmergencyVehicleDto, {
      patente: ' ',
      denominacion: '',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'patente',
        'denominacion',
        'tipoId',
        'marcaId',
        'modeloId',
      ]),
    );
  });

  it('rechaza ids que no son uuid', async () => {
    const { errors } = await validateDto(CreateEmergencyVehicleDto, {
      ...validVehicleBody(),
      tipoId: '1',
    });
    expect(errors).toContain('tipoId');
  });
});

describe('UpdateEmergencyVehicleDto', () => {
  it('acepta el mismo shape que create', async () => {
    const { errors } = await validateDto(
      UpdateEmergencyVehicleDto,
      validVehicleBody(),
    );
    expect(errors).toEqual([]);
  });
});

describe('ListEmergencyVehiclesDto', () => {
  it('aplica defaults de paginación y orden', async () => {
    const { dto, errors } = await validateDto(ListEmergencyVehiclesDto, {});
    expect(errors).toEqual([]);
    expect(dto.ordenPor).toBe('denominacion');
    expect(dto.orden).toBe('asc');
    expect(dto.pagina).toBe(1);
    expect(dto.porPagina).toBe(20);
  });

  it('acepta estados activos', async () => {
    for (const estado of ACTIVE_VEHICLE_STATUSES) {
      const { errors } = await validateDto(ListEmergencyVehiclesDto, {
        estado,
      });
      expect(errors).toEqual([]);
    }
  });

  it('rechaza BAJA_DEFINITIVA y ordenPor inválido', async () => {
    const { errors: estadoErrors } = await validateDto(
      ListEmergencyVehiclesDto,
      { estado: 'BAJA_DEFINITIVA' },
    );
    expect(estadoErrors).toContain('estado');

    const { errors: ordenErrors } = await validateDto(
      ListEmergencyVehiclesDto,
      { ordenPor: 'creado_en' },
    );
    expect(ordenErrors).toContain('ordenPor');
  });

  it('acepta filtros tipoId uuid y busqueda', async () => {
    const { dto, errors } = await validateDto(ListEmergencyVehiclesDto, {
      tipoId: TIPO_ID,
      busqueda: 'AB',
      ordenPor: 'patente',
      orden: 'desc',
    });
    expect(errors).toEqual([]);
    expect(dto.tipoId).toBe(TIPO_ID);
    expect(dto.ordenPor).toBe('patente');
  });
});

describe('WriteOffEmergencyVehicleDto', () => {
  it('acepta motivo no vacío', async () => {
    const { dto, errors } = await validateDto(WriteOffEmergencyVehicleDto, {
      motivo: '  Fin de vida útil  ',
    });
    expect(errors).toEqual([]);
    expect(dto.motivo).toBe('Fin de vida útil');
  });

  it('rechaza motivo vacío', async () => {
    const { errors } = await validateDto(WriteOffEmergencyVehicleDto, {
      motivo: '   ',
    });
    expect(errors).toContain('motivo');
  });
});

describe('forbidNonWhitelisted (fleet DTOs)', () => {
  it('rechaza campos no contemplados en create/update/list/writeOff', async () => {
    await expect(
      validateDto(CreateEmergencyVehicleDto, {
        ...validVehicleBody(),
        estado: 'OPERATIVO',
      }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['estado']) });

    await expect(
      validateDto(UpdateEmergencyVehicleDto, {
        ...validVehicleBody(),
        extra: true,
      }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['extra']) });

    await expect(
      validateDto(ListEmergencyVehiclesDto, { foo: 'bar' }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['foo']) });

    await expect(
      validateDto(WriteOffEmergencyVehicleDto, {
        motivo: 'ok',
        otro: 1,
      }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['otro']) });
  });

  it('rechaza campos no contemplados en DTOs de catálogo', async () => {
    await expect(
      validateDto(CreateCatalogItemDto, { valor: 'X', activo: false }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['activo']) });

    await expect(
      validateDto(UpdateCatalogItemDto, { valor: 'X', id: TIPO_ID }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['id']) });

    await expect(
      validateDto(CreateCatalogModelDto, {
        valor: 'Ranger',
        marcaId: MARCA_ID,
        tipoId: TIPO_ID,
      }),
    ).resolves.toMatchObject({ errors: expect.arrayContaining(['tipoId']) });
  });
});
