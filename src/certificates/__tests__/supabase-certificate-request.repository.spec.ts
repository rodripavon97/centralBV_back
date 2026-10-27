import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import {
  buildSearchFilter,
  SupabaseCertificateRequestRepository,
} from '../repositories/supabase-certificate-request.repository.js';
import type { CertificateRequestData } from '../domain/certificate-request.repository.js';

const ID = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

const listRow = {
  id: ID,
  numero: 'SOL-0001',
  estado: 'PENDIENTE' as const,
  tipo_constancia: 'VIVIENDA' as const,
  fecha_actuacion: '2026-10-11',
  hora_actuacion: '18:20:00',
  domicilio_hecho: 'Calle San Martín 450',
  parte_numero: 'P-2026-0142',
  localidad: 'Morón',
  partido: 'Morón',
  motivo: 'Constancia para el seguro',
  perdidas: 'Daños en cocina',
  destino: 'SEGURO' as const,
  razon_social: 'La Caja Seguros',
  numero_poliza: 'POL-998877',
  patente_vehiculo: null,
  observaciones: null,
  estado_arancel: 'PENDIENTE' as const,
  monto: null,
  metodo_pago: null,
  motivo_exento: null,
  fecha_pago: null,
  motivo_cancelacion: null,
  creado_en: '2026-10-11T12:00:00.000Z',
  cancelado_en: null,
  retirado_en: null,
  retirado_por_nombre: null,
  retirado_por_dni: null,
  dni: '30112456',
  nombre: 'Lucía Fernández',
  telefono: '11 5555-0142',
};

const requestData = (): CertificateRequestData => ({
  damnificado: {
    nombre: 'Lucía Fernández',
    dni: '30112456',
    telefono: '11 5555-0142',
  },
  siniestro: {
    tipo: 'VIVIENDA',
    fecha: '2026-10-11',
    hora: '18:20',
    direccion: 'Calle San Martín 450',
    numeroParte: 'P-2026-0142',
    motivo: 'Constancia para el seguro',
    localidad: 'Morón',
    partido: 'Morón',
    perdidas: 'Daños en cocina',
    patenteVehiculo: null,
  },
  constancia: {
    destino: 'SEGURO',
    razonSocial: 'La Caja Seguros',
    numeroPoliza: 'POL-998877',
  },
});

/** Fluent thenable mock for Supabase query builders. */
function createQueryMock(resolved: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = new Proxy(chain, {
    get(target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(resolved).then(resolve, reject);
      }
      if (!target[prop]) {
        target[prop] = vi.fn().mockReturnValue(self);
      }
      return target[prop];
    },
  });
  return self;
}

describe('buildSearchFilter (US09)', () => {
  it('searches by DNI and number when only digits are typed, with or without dots', () => {
    expect(buildSearchFilter('30.112.456')).toBe(
      'dni.ilike."%30112456%",numero.ilike."%30112456%"',
    );
  });

  it('searches by number and victim name', () => {
    expect(buildSearchFilter('Lucía Fer')).toBe(
      'numero.ilike."%Lucía Fer%",nombre.ilike."%Lucía Fer%"',
    );
  });

  it('strips quotes and wildcards so PostgREST filter syntax is not broken', () => {
    expect(buildSearchFilter('"%*')).toBeNull();
    expect(buildSearchFilter('SOL-"0001"')).toContain(
      'numero.ilike."%SOL-0001%"',
    );
  });
});

describe('SupabaseCertificateRequestRepository', () => {
  let repo: SupabaseCertificateRequestRepository;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    from = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseCertificateRequestRepository,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from }) },
        },
      ],
    }).compile();
    repo = module.get(SupabaseCertificateRequestRepository);
  });

  describe('findAll / findCompleted', () => {
    it('retorna vacío cuando el total es 0', async () => {
      from.mockReturnValue(
        createQueryMock({ count: 0, error: null, data: null }),
      );
      await expect(
        repo.findAll({
          orden: 'desc',
          pagina: 1,
          porPagina: 20,
        }),
      ).resolves.toEqual({ items: [], total: 0 });
    });

    it('lista solicitudes activas con mapeo de dominio', async () => {
      let call = 0;
      from.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return createQueryMock({ count: 1, error: null, data: null });
        }
        return createQueryMock({ data: [listRow], error: null });
      });

      const result = await repo.findAll({
        orden: 'desc',
        pagina: 1,
        porPagina: 20,
        busqueda: 'Lucía',
        estado: 'PENDIENTE',
      });

      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: ID,
          numero: 'SOL-0001',
          estado: 'PENDIENTE',
          damnificado: expect.objectContaining({ dni: '30112456' }),
          siniestro: expect.objectContaining({ hora: '18:20' }),
          abono: null,
        }),
      );
    });

    it('lista solo RETIRADA en findCompleted', async () => {
      const retired = {
        ...listRow,
        estado: 'RETIRADA' as const,
        estado_arancel: 'ABONADO' as const,
        monto: 1500,
        metodo_pago: 'EFECTIVO' as const,
        fecha_pago: '2026-10-12T10:00:00.000Z',
      };
      let call = 0;
      from.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return createQueryMock({ count: 1, error: null, data: null });
        }
        return createQueryMock({ data: [retired], error: null });
      });

      const result = await repo.findCompleted({
        orden: 'asc',
        pagina: 1,
        porPagina: 20,
      });
      expect(result.items[0].estado).toBe('RETIRADA');
      expect(result.items[0].abono).toEqual(
        expect.objectContaining({
          estado: 'ABONADO',
          monto: 1500,
        }),
      );
    });

    it('mapea errores de count a excepciones Nest', async () => {
      from.mockReturnValue(
        createQueryMock({
          count: null,
          error: { code: '23514', message: 'check failed' },
          data: null,
        }),
      );
      await expect(
        repo.findAll({ orden: 'desc', pagina: 1, porPagina: 20 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('retorna la solicitud o null', async () => {
      from.mockReturnValue(createQueryMock({ data: listRow, error: null }));
      await expect(repo.findById(ID)).resolves.toEqual(
        expect.objectContaining({ id: ID }),
      );

      from.mockReturnValue(createQueryMock({ data: null, error: null }));
      await expect(repo.findById(ID)).resolves.toBeNull();
    });

    it('mapea errores de lectura', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: null,
          error: { code: '23505', message: 'conflict' },
        }),
      );
      await expect(repo.findById(ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('create', () => {
    it('crea damnificado + constancia y relee la solicitud', async () => {
      from.mockImplementation((table: string) => {
        if (table === 'damnificados') {
          return createQueryMock({ data: { id: 'vic-1' }, error: null });
        }
        if (table === 'constancias') {
          return createQueryMock({ data: { id: ID }, error: null });
        }
        return createQueryMock({ data: listRow, error: null });
      });

      const created = await repo.create(requestData(), 'user-1');
      expect(created.id).toBe(ID);
    });

    it('revierte el damnificado si falla el insert de constancia', async () => {
      const deleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
      from.mockImplementation((table: string) => {
        if (table === 'damnificados') {
          const q = createQueryMock({ data: { id: 'vic-1' }, error: null });
          q.delete = vi.fn().mockReturnValue({ eq: deleteEq });
          return q;
        }
        return createQueryMock({
          data: null,
          error: { message: 'constancia failed' },
        });
      });

      await expect(repo.create(requestData(), null)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(deleteEq).toHaveBeenCalledWith('id', 'vic-1');
    });
  });

  describe('updatePending', () => {
    it('retorna null si no hay snapshot PENDIENTE', async () => {
      from.mockReturnValue(createQueryMock({ data: null, error: null }));
      await expect(repo.updatePending(ID, requestData())).resolves.toBeNull();
    });

    it('actualiza constancia y damnificado', async () => {
      let call = 0;
      from.mockImplementation((table: string) => {
        if (table === 'constancias') {
          call += 1;
          if (call === 1) {
            return createQueryMock({
              data: {
                damnificado_id: 'vic-1',
                tipo_constancia: 'VIVIENDA',
                fecha_actuacion: '2026-10-11',
                hora_actuacion: '18:20:00',
                domicilio_hecho: 'x',
                parte_numero: 'p',
                localidad: 'l',
                partido: 'p',
                motivo: 'm',
                perdidas: 'p',
                destino: 'SEGURO',
                razon_social: 'r',
                numero_poliza: 'n',
                patente_vehiculo: null,
              },
              error: null,
            });
          }
          if (call === 2) {
            return createQueryMock({
              data: [{ damnificado_id: 'vic-1' }],
              error: null,
            });
          }
        }
        if (table === 'damnificados') {
          return createQueryMock({ data: null, error: null });
        }
        return createQueryMock({ data: listRow, error: null });
      });

      await expect(repo.updatePending(ID, requestData())).resolves.toEqual(
        expect.objectContaining({ id: ID }),
      );
    });
  });

  describe('cancelPending / markAsRealized / signRequest', () => {
    it('cancela si sigue PENDIENTE', async () => {
      let call = 0;
      from.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return createQueryMock({ data: [{ id: ID }], error: null });
        }
        return createQueryMock({
          data: { ...listRow, estado: 'CANCELADA' as const },
          error: null,
        });
      });
      await expect(repo.cancelPending(ID, 'duplicada')).resolves.toEqual(
        expect.objectContaining({ estado: 'CANCELADA' }),
      );
    });

    it('cancelPending retorna null si no hay filas', async () => {
      from.mockReturnValue(createQueryMock({ data: [], error: null }));
      await expect(repo.cancelPending(ID, 'x')).resolves.toBeNull();
    });

    it('markAsRealized retorna true/false según filas afectadas', async () => {
      from.mockReturnValue(createQueryMock({ data: [{ id: ID }], error: null }));
      await expect(repo.markAsRealized(ID, 'obs')).resolves.toBe(true);

      from.mockReturnValue(createQueryMock({ data: [], error: null }));
      await expect(repo.markAsRealized(ID, null)).resolves.toBe(false);
    });

    it('signRequest retorna true/false según filas afectadas', async () => {
      from.mockReturnValue(createQueryMock({ data: [{ id: ID }], error: null }));
      await expect(repo.signRequest(ID)).resolves.toBe(true);

      from.mockReturnValue(createQueryMock({ data: [], error: null }));
      await expect(repo.signRequest(ID)).resolves.toBe(false);
    });
  });

  describe('addPayment / markAsDelivered', () => {
    it('registra pago y relee', async () => {
      let call = 0;
      from.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return createQueryMock({ data: [{ id: ID }], error: null });
        }
        return createQueryMock({
          data: {
            ...listRow,
            estado_arancel: 'ABONADO' as const,
            monto: 1000,
            metodo_pago: 'EFECTIVO' as const,
            fecha_pago: '2026-10-12T10:00:00.000Z',
          },
          error: null,
        });
      });

      const result = await repo.addPayment(ID, {
        estado: 'ABONADO',
        monto: 1000,
        metodoPago: 'EFECTIVO',
        fechaPago: '2026-10-12T10:00:00.000Z',
        motivoExento: null,
      });
      expect(result?.abono?.estado).toBe('ABONADO');
    });

    it('addPayment retorna null si no actualiza', async () => {
      from.mockReturnValue(createQueryMock({ data: [], error: null }));
      await expect(
        repo.addPayment(ID, {
          estado: 'EXENTO',
          monto: null,
          metodoPago: null,
          fechaPago: '2026-10-12T10:00:00.000Z',
          motivoExento: 'acción social',
        }),
      ).resolves.toBeNull();
    });

    it('marca como entregada y relee', async () => {
      let call = 0;
      from.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return createQueryMock({ data: [{ id: ID }], error: null });
        }
        return createQueryMock({
          data: {
            ...listRow,
            estado: 'RETIRADA' as const,
            estado_arancel: 'ABONADO' as const,
            monto: 1000,
            metodo_pago: 'EFECTIVO' as const,
            fecha_pago: '2026-10-12T10:00:00.000Z',
            retirado_por_nombre: 'Juan Perez',
            retirado_por_dni: '20111222',
          },
          error: null,
        });
      });

      const result = await repo.markAsDelivered(ID, {
        nombreCompleto: 'Juan Perez',
        dni: '20111222',
      });
      expect(result?.estado).toBe('RETIRADA');
    });

    it('markAsDelivered retorna null si no hay filas', async () => {
      from.mockReturnValue(createQueryMock({ data: [], error: null }));
      await expect(
        repo.markAsDelivered(ID, { nombreCompleto: 'X', dni: '1' }),
      ).resolves.toBeNull();
    });
  });
});
