import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConstanciasService } from './constancias.service.js';
import { SOLICITUD_REPOSITORY } from './domain/solicitud.repository.js';
import type { EstadoSolicitud, Solicitud } from './domain/solicitud.entity.js';
import { GuardarSolicitudDto } from './dtos/guardar-solicitud.dto.js';
import { ListarSolicitudesDto } from './dtos/listar-solicitudes.dto.js';

const ID = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

const solicitud = (estado: EstadoSolicitud = 'PENDIENTE'): Solicitud => ({
  id: ID,
  numero: 'SOL-0001',
  estado,
  fechaAlta: '2026-10-11T21:20:00Z',
  damnificado: { nombre: 'Lucía', apellido: 'Fernández', dni: '30112456', telefono: null, domicilio: null },
  siniestro: { tipo: 'VIVIENDA', fechaHora: '2026-10-11T18:20', lugar: 'Calle San Martín 450', descripcion: 'Incendio en cocina' },
  motivoCancelacion: null,
  canceladoEn: null,
});

const dto = (fechaHora = '2026-10-11T18:20') =>
  Object.assign(new GuardarSolicitudDto(), {
    damnificado: { nombre: 'Lucía', apellido: 'Fernández', dni: '30112456', telefono: null, domicilio: null },
    siniestro: { tipo: 'VIVIENDA', fechaHora, lugar: 'Calle San Martín 450', descripcion: 'Incendio en cocina' },
  });

describe('ConstanciasService', () => {
  let service: ConstanciasService;
  let repo: {
    listar: ReturnType<typeof vi.fn>;
    buscarPorId: ReturnType<typeof vi.fn>;
    crear: ReturnType<typeof vi.fn>;
    actualizarPendiente: ReturnType<typeof vi.fn>;
    cancelarPendiente: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      listar: vi.fn(),
      buscarPorId: vi.fn(),
      crear: vi.fn(),
      actualizarPendiente: vi.fn(),
      cancelarPendiente: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConstanciasService, { provide: SOLICITUD_REPOSITORY, useValue: repo }],
    }).compile();
    service = module.get(ConstanciasService);
  });

  describe('listar (US09)', () => {
    it('calcula las páginas con 20 registros por página', async () => {
      repo.listar.mockResolvedValue({ items: [solicitud()], total: 47 });
      const query = Object.assign(new ListarSolicitudesDto(), { pagina: 2 });

      const resultado = await service.listar(query);

      expect(repo.listar).toHaveBeenCalledWith({
        busqueda: undefined,
        estado: undefined,
        orden: 'desc',
        pagina: 2,
        porPagina: 20,
      });
      expect(resultado).toMatchObject({ total: 47, pagina: 2, paginas: 3, porPagina: 20 });
    });

    it('limita la página pedida a la última que existe', async () => {
      repo.listar.mockResolvedValue({ items: [], total: 5 });
      const resultado = await service.listar(Object.assign(new ListarSolicitudesDto(), { pagina: 9 }));
      expect(resultado).toMatchObject({ pagina: 1, paginas: 1 });
    });

    it('ignora una búsqueda vacía', async () => {
      repo.listar.mockResolvedValue({ items: [], total: 0 });
      await service.listar(Object.assign(new ListarSolicitudesDto(), { busqueda: '   ' }));
      expect(repo.listar.mock.calls[0][0].busqueda).toBeUndefined();
    });
  });

  describe('crear (US08)', () => {
    it('guarda la solicitud con el usuario que la carga', async () => {
      repo.crear.mockResolvedValue(solicitud());
      await service.crear(dto(), 'usuario-1');
      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ siniestro: expect.objectContaining({ fechaHora: '2026-10-11T18:20' }) }),
        'usuario-1',
      );
    });

    it('rechaza una fecha que no existe', async () => {
      await expect(service.crear(dto('2026-02-30T10:00'), null)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('rechaza una fecha futura', async () => {
      await expect(service.crear(dto('2999-01-01T10:00'), null)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('obtener', () => {
    it('devuelve 404 si la solicitud no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.obtener(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('actualizar (US13)', () => {
    it('edita una solicitud pendiente', async () => {
      repo.buscarPorId.mockResolvedValue(solicitud());
      repo.actualizarPendiente.mockResolvedValue(solicitud());
      await expect(service.actualizar(ID, dto())).resolves.toMatchObject({ estado: 'PENDIENTE' });
    });

    it.each(['REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'no permite editar una solicitud %s',
      async (estado) => {
        repo.buscarPorId.mockResolvedValue(solicitud(estado));
        await expect(service.actualizar(ID, dto())).rejects.toBeInstanceOf(ConflictException);
        expect(repo.actualizarPendiente).not.toHaveBeenCalled();
      },
    );

    it('devuelve conflicto si dejó de estar pendiente mientras se editaba', async () => {
      repo.buscarPorId.mockResolvedValue(solicitud());
      repo.actualizarPendiente.mockResolvedValue(null);
      await expect(service.actualizar(ID, dto())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cancelar (US13)', () => {
    it('cancela una solicitud pendiente con su motivo', async () => {
      repo.buscarPorId.mockResolvedValue(solicitud());
      repo.cancelarPendiente.mockResolvedValue({ ...solicitud('CANCELADA'), motivoCancelacion: 'No corresponde' });

      const resultado = await service.cancelar(ID, 'No corresponde');

      expect(repo.cancelarPendiente).toHaveBeenCalledWith(ID, 'No corresponde');
      expect(resultado.estado).toBe('CANCELADA');
    });

    it('no permite cancelar una solicitud firmada', async () => {
      repo.buscarPorId.mockResolvedValue(solicitud('FIRMADA'));
      await expect(service.cancelar(ID, 'No corresponde')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.cancelarPendiente).not.toHaveBeenCalled();
    });
  });
});
