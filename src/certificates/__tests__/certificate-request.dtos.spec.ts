import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { CreateCertificateRequestDto } from '../dtos/create-certificate-request.dto.js';
import { CancelCertificateRequestDto } from '../dtos/cancel-certificate-request.dto.js';
import { ListCertificateRequestsDto } from '../dtos/list-certificate-requests.dto.js';
import { ListCompletedCertificateRequestsDto } from '../dtos/list-completed-certificate-requests.dto.js';
import { AddPaymentDto } from '../dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from '../dtos/deliver-certificate-request.dto.js';
import { RealizeCertificateRequestDto } from '../dtos/realize-certificate-request.dto.js';
import { ACTIVE_REQUEST_STATUSES } from '../domain/certificate-request.enums.js';

const validPayload = () => ({
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

const propertiesWithError = (
  errors: ValidationError[],
  prefix = '',
): string[] =>
  errors.flatMap((e) =>
    e.children?.length
      ? propertiesWithError(e.children, `${prefix}${e.property}.`)
      : [`${prefix}${e.property}`],
  );

const validateCreate = async (data: unknown) => {
  const dto = plainToInstance(CreateCertificateRequestDto, data);
  return {
    dto,
    errors: propertiesWithError(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ),
  };
};

describe('CreateCertificateRequestDto (US08)', () => {
  it('accepts a complete request', async () => {
    expect((await validateCreate(validPayload())).errors).toEqual([]);
  });

  it('accepts empty phone and stores it as null', async () => {
    const data = validPayload();
    data.damnificado.telefono = '';
    const { dto, errors } = await validateCreate(data);
    expect(errors).toEqual([]);
    expect(dto.damnificado.telefono).toBeNull();
  });

  it('requires mandatory fields', async () => {
    const { errors } = await validateCreate({
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
    expect(errors).toEqual(
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

  it('rejects a DNI with dots or fewer than 7 digits', async () => {
    for (const dni of ['30.112.456', '301124']) {
      const data = validPayload();
      data.damnificado.dni = dni;
      expect((await validateCreate(data)).errors).toContain('damnificado.dni');
    }
  });

  it('rejects a name with numbers and an invalid phone', async () => {
    const data = validPayload();
    data.damnificado.nombre = 'Lucía 2';
    data.damnificado.telefono = 'abc';
    expect((await validateCreate(data)).errors).toEqual(
      expect.arrayContaining(['damnificado.nombre', 'damnificado.telefono']),
    );
  });

  it('accepts VIVIENDA and VEHICULAR and rejects ACCIDENTE_TRANSITO', async () => {
    for (const tipo of ['VIVIENDA', 'VEHICULAR']) {
      const data = validPayload();
      data.siniestro.tipo = tipo;
      if (tipo === 'VEHICULAR') data.siniestro.patenteVehiculo = 'AB123CD';
      expect((await validateCreate(data)).errors).toEqual([]);
    }
    const data = validPayload();
    data.siniestro.tipo = 'ACCIDENTE_TRANSITO';
    expect((await validateCreate(data)).errors).toContain('siniestro.tipo');
  });

  it('rejects a date in dd/mm/yyyy format', async () => {
    const data = validPayload();
    data.siniestro.fecha = '11/10/2026';
    expect((await validateCreate(data)).errors).toContain('siniestro.fecha');
  });

  it('requires damnificado, siniestro and constancia', async () => {
    expect((await validateCreate({})).errors).toEqual([
      'damnificado',
      'siniestro',
      'constancia',
    ]);
  });
});

describe('CancelCertificateRequestDto (US13)', () => {
  it('requires a reason that is not only whitespace', async () => {
    const errors = await validate(
      plainToInstance(CancelCertificateRequestDto, { motivo: '  ' }),
    );
    expect(errors.some((e) => e.property === 'motivo')).toBe(true);
  });
});

describe('ListCertificateRequestsDto (US09)', () => {
  it('applies pagination and sort defaults', async () => {
    const dto = plainToInstance(ListCertificateRequestsDto, {});
    await validate(dto);
    expect(dto.pagina).toBe(1);
    expect(dto.porPagina).toBe(20);
    expect(dto.orden).toBe('desc');
  });

  it('rejects RETIRADA status on the active list', async () => {
    const errors = await validate(
      plainToInstance(ListCertificateRequestsDto, { estado: 'RETIRADA' }),
    );
    expect(errors.some((e) => e.property === 'estado')).toBe(true);
  });

  it('accepts active statuses', async () => {
    for (const estado of ACTIVE_REQUEST_STATUSES) {
      const errors = await validate(
        plainToInstance(ListCertificateRequestsDto, { estado }),
      );
      expect(errors.filter((e) => e.property === 'estado')).toEqual([]);
    }
  });
});

describe('ListCompletedCertificateRequestsDto', () => {
  it('applies pagination and sort defaults', async () => {
    const dto = plainToInstance(ListCompletedCertificateRequestsDto, {});
    await validate(dto);
    expect(dto.pagina).toBe(1);
    expect(dto.porPagina).toBe(20);
    expect(dto.orden).toBe('desc');
  });

  it('does not define an estado property', () => {
    const dto = new ListCompletedCertificateRequestsDto();
    expect('estado' in dto).toBe(false);
  });
});

describe('AddPaymentDto', () => {
  it('accepts a complete ABONADO payment', async () => {
    const dto = plainToInstance(AddPaymentDto, {
      estado: 'ABONADO',
      monto: 1500,
      metodoPago: 'EFECTIVO',
    });
    expect(await validate(dto)).toEqual([]);
  });
});

describe('DeliverCertificateRequestDto', () => {
  it('requires full name and DNI', async () => {
    const errors = await validate(
      plainToInstance(DeliverCertificateRequestDto, {}),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['nombreCompleto', 'dni']),
    );
  });
});

describe('RealizeCertificateRequestDto', () => {
  it('accepts empty body and defaults observaciones to null', async () => {
    const dto = plainToInstance(RealizeCertificateRequestDto, {});
    expect(await validate(dto)).toEqual([]);
    expect(dto.observaciones).toBeNull();
  });

  it('trims observaciones and turns blank into null', async () => {
    const dto = plainToInstance(RealizeCertificateRequestDto, {
      observaciones: '  Se acompañan fotos.  ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.observaciones).toBe('Se acompañan fotos.');

    const blank = plainToInstance(RealizeCertificateRequestDto, {
      observaciones: '   ',
    });
    expect(await validate(blank)).toEqual([]);
    expect(blank.observaciones).toBeNull();
  });

  it('rejects observaciones longer than 2000 characters', async () => {
    const dto = plainToInstance(RealizeCertificateRequestDto, {
      observaciones: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'observaciones')).toBe(true);
  });
});
