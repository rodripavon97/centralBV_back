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
    nombre: 'Lucía',
    apellido: 'Fernández',
    dni: '30112456',
    telefono: '11 5555-0142',
    domicilio: 'Calle San Martín 450',
  },
  siniestro: {
    tipo: 'VIVIENDA',
    fechaHora: '2026-10-11T18:20',
    lugar: 'Calle San Martín 450',
    descripcion: 'Incendio en cocina',
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

  it('acepta teléfono y domicilio vacíos y los guarda como null', async () => {
    const data = valido();
    data.damnificado.telefono = '';
    data.damnificado.domicilio = '  ';
    const { dto, errores } = await validar(data);
    expect(errores).toEqual([]);
    expect(dto.damnificado.telefono).toBeNull();
    expect(dto.damnificado.domicilio).toBeNull();
  });

  it('exige los campos obligatorios', async () => {
    const { errores } = await validar({
      damnificado: { nombre: ' ', apellido: '', dni: '' },
      siniestro: { tipo: '', fechaHora: '', lugar: '', descripcion: '' },
    });
    expect(errores).toEqual(
      expect.arrayContaining([
        'damnificado.nombre',
        'damnificado.apellido',
        'damnificado.dni',
        'siniestro.tipo',
        'siniestro.fechaHora',
        'siniestro.lugar',
        'siniestro.descripcion',
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

  it('acepta los tres tipos de siniestro y rechaza otros', async () => {
    for (const tipo of ['VIVIENDA', 'VEHICULAR', 'ACCIDENTE_TRANSITO']) {
      const data = valido();
      data.siniestro.tipo = tipo;
      expect((await validar(data)).errores).toEqual([]);
    }
    const data = valido();
    data.siniestro.tipo = 'INUNDACION';
    expect((await validar(data)).errores).toContain('siniestro.tipo');
  });

  it('rechaza una fecha con formato dd/mm/aaaa', async () => {
    const data = valido();
    data.siniestro.fechaHora = '11/10/2026 18:20';
    expect((await validar(data)).errores).toContain('siniestro.fechaHora');
  });

  it('exige los objetos damnificado y siniestro', async () => {
    expect((await validar({})).errores).toEqual(['damnificado', 'siniestro']);
  });
});

describe('CancelCertificateRequestDto (US13)', () => {
  it('exige un motivo que no sea solo espacios', async () => {
    const errores = await validate(
      plainToInstance(CancelCertificateRequestDto, { motivo: '   ' }),
    );
    expect(errores[0]?.property).toBe('motivo');
  });

  it('acepta un motivo válido', async () => {
    const errores = await validate(
      plainToInstance(CancelCertificateRequestDto, {
        motivo: 'No corresponde al cuartel',
      }),
    );
    expect(errores).toHaveLength(0);
  });
});

describe('ListCertificateRequestsDto (US09)', () => {
  it('usa orden descendente, página 1 y 20 por página por defecto', async () => {
    const dto = plainToInstance(ListCertificateRequestsDto, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ orden: 'desc', pagina: 1, porPagina: 20 });
  });

  it('convierte la página que llega como texto y rechaza un estado inexistente', async () => {
    const dto = plainToInstance(ListCertificateRequestsDto, {
      pagina: '3',
      estado: 'ENTREGADA',
    });
    const errores = await validate(dto);
    expect(dto.pagina).toBe(3);
    expect(errores.map((e) => e.property)).toEqual(['estado']);
  });
});

describe('AddPaymentDto', () => {
  const validarAbono = (data: unknown) =>
    validate(plainToInstance(AddPaymentDto, data), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('acepta ABONADO con monto y método', async () => {
    expect(
      await validarAbono({
        estado: 'ABONADO',
        monto: '1500.50',
        metodoPago: 'TRANSFERENCIA',
      }),
    ).toHaveLength(0);
  });

  it('acepta EXENTO con motivo', async () => {
    expect(
      await validarAbono({
        estado: 'EXENTO',
        motivoExento: 'Beneficiario de acción social',
      }),
    ).toHaveLength(0);
  });

  it('exige monto y método si es ABONADO', async () => {
    const errores = await validarAbono({ estado: 'ABONADO' });
    expect(errores.map((e) => e.property)).toEqual(
      expect.arrayContaining(['monto', 'metodoPago']),
    );
  });

  it('exige motivoExento si es EXENTO', async () => {
    const errores = await validarAbono({ estado: 'EXENTO', motivoExento: '  ' });
    expect(errores.map((e) => e.property)).toContain('motivoExento');
  });

  it('rechaza un estado inválido o PENDIENTE', async () => {
    for (const estado of ['PENDIENTE', 'PAGADO']) {
      const errores = await validarAbono({ estado });
      expect(errores.map((e) => e.property)).toContain('estado');
    }
  });

  it('rechaza monto cero o método inválido', async () => {
    const errores = await validarAbono({
      estado: 'ABONADO',
      monto: 0,
      metodoPago: 'CHEQUE',
    });
    expect(errores.map((e) => e.property)).toEqual(
      expect.arrayContaining(['monto', 'metodoPago']),
    );
  });
});

describe('DeliverCertificateRequestDto', () => {
  const validarEntrega = (data: unknown) =>
    validate(plainToInstance(DeliverCertificateRequestDto, data));

  it('rechaza body vacío', async () => {
    const errores = await validarEntrega({});
    expect(errores.map((e) => e.property)).toEqual(
      expect.arrayContaining(['nombreCompleto', 'dni']),
    );
  });

  it('acepta nombre y DNI válidos', async () => {
    expect(
      await validarEntrega({
        nombreCompleto: 'María López',
        dni: '30112456',
      }),
    ).toHaveLength(0);
  });

  it('rechaza nombre con números y DNI con puntos', async () => {
    const errores = await validarEntrega({
      nombreCompleto: 'María 2',
      dni: '30.112.456',
    });
    expect(errores.map((e) => e.property)).toEqual(
      expect.arrayContaining(['nombreCompleto', 'dni']),
    );
  });

  it('rechaza strings vacíos tras el trim', async () => {
    const errores = await validarEntrega({
      nombreCompleto: '  ',
      dni: '',
    });
    expect(errores.map((e) => e.property)).toEqual(
      expect.arrayContaining(['nombreCompleto', 'dni']),
    );
  });
});
