import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { CreateCertificateRequestDto } from '../dtos/create-certificate-request.dto.js';
import { CancelCertificateRequestDto } from '../dtos/cancel-certificate-request.dto.js';
import { ListCertificateRequestsDto } from '../dtos/list-certificate-requests.dto.js';
import { AddPaymentDto } from '../dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from '../dtos/deliver-certificate-request.dto.js';

const valido = () => ({
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

const propiedadesConError = (
  errores: ValidationError[],
  prefijo = '',
): string[] =>
  errores.flatMap((e) =>
    e.children?.length
      ? propiedadesConError(e.children, `${prefijo}${e.property}.`)
      : [`${prefijo}${e.property}`],
  );

const validar = async (data: unknown) => {
  const dto = plainToInstance(CreateCertificateRequestDto, data);
  return {
    dto,
    errores: propiedadesConError(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ),
  };
};

describe('CreateCertificateRequestDto (US08)', () => {
  it('acepta una solicitud completa', async () => {
    expect((await validar(valido())).errores).toEqual([]);
  });

  it('acepta teléfono vacío y lo guarda como null', async () => {
    const data = valido();
    data.damnificado.telefono = '';
    const { dto, errores } = await validar(data);
    expect(errores).toEqual([]);
    expect(dto.damnificado.telefono).toBeNull();
  });

  it('exige los campos obligatorios', async () => {
    const { errores } = await validar({
      damnificado: { nombre: ' ', dni: '' },
      siniestro: {
        tipo: '',
        fecha: '',
        hora: '',
        direccion: '',
        numeroParte: '',
        motivo: '',
        localidad: '',
        partido: '',
        perdidas: '',
      },
      constancia: { destino: '', razonSocial: '' },
    });
    expect(errores).toEqual(
      expect.arrayContaining([
        'damnificado.nombre',
        'damnificado.dni',
        'siniestro.tipo',
        'siniestro.fecha',
        'siniestro.hora',
        'siniestro.direccion',
        'siniestro.numeroParte',
        'siniestro.motivo',
        'siniestro.localidad',
        'siniestro.partido',
        'siniestro.perdidas',
        'constancia.destino',
        'constancia.razonSocial',
      ]),
    );
  });

  it('rechaza un DNI con puntos o con menos de 7 dígitos', async () => {
    for (const dni of ['30.112.456', '301124']) {
      const data = valido();
      data.damnificado.dni = dni;
      expect((await validar(data)).errores).toContain('damnificado.dni');
    }
  });

  it('rechaza un nombre con números y un teléfono inválido', async () => {
    const data = valido();
    data.damnificado.nombre = 'Lucía 2';
    data.damnificado.telefono = 'abc';
    expect((await validar(data)).errores).toEqual(
      expect.arrayContaining(['damnificado.nombre', 'damnificado.telefono']),
    );
  });

  it('acepta VIVIENDA y VEHICULAR y rechaza ACCIDENTE_TRANSITO', async () => {
    for (const tipo of ['VIVIENDA', 'VEHICULAR']) {
      const data = valido();
      data.siniestro.tipo = tipo;
      if (tipo === 'VEHICULAR') data.siniestro.patenteVehiculo = 'AB123CD';
      expect((await validar(data)).errores).toEqual([]);
    }
    const data = valido();
    data.siniestro.tipo = 'ACCIDENTE_TRANSITO';
    expect((await validar(data)).errores).toContain('siniestro.tipo');
  });

  it('rechaza una fecha con formato dd/mm/aaaa', async () => {
    const data = valido();
    data.siniestro.fecha = '11/10/2026';
    expect((await validar(data)).errores).toContain('siniestro.fecha');
  });

  it('exige damnificado, siniestro y constancia', async () => {
    expect((await validar({})).errores).toEqual([
      'damnificado',
      'siniestro',
      'constancia',
    ]);
  });
});

describe('CancelCertificateRequestDto (US13)', () => {
  it('exige un motivo que no sea solo espacios', async () => {
    const errores = await validate(
      plainToInstance(CancelCertificateRequestDto, { motivo: '  ' }),
    );
    expect(errores.some((e) => e.property === 'motivo')).toBe(true);
  });
});

describe('ListCertificateRequestsDto (US09)', () => {
  it('aplica defaults de paginación y orden', async () => {
    const dto = plainToInstance(ListCertificateRequestsDto, {});
    await validate(dto);
    expect(dto.pagina).toBe(1);
    expect(dto.porPagina).toBe(20);
    expect(dto.orden).toBe('desc');
  });
});

describe('AddPaymentDto', () => {
  it('acepta un abono completo', async () => {
    const dto = plainToInstance(AddPaymentDto, {
      estado: 'ABONADO',
      monto: 1500,
      metodoPago: 'EFECTIVO',
    });
    expect(await validate(dto)).toEqual([]);
  });
});

describe('DeliverCertificateRequestDto', () => {
  it('exige nombre completo y DNI', async () => {
    const errores = await validate(
      plainToInstance(DeliverCertificateRequestDto, {}),
    );
    expect(errores.map((e) => e.property)).toEqual(
      expect.arrayContaining(['nombreCompleto', 'dni']),
    );
  });
});
