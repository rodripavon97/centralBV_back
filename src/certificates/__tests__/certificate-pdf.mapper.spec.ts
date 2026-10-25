import type { CertificateRequest } from '../domain/certificate-request.entity.js';
import {
  formatDni,
  formatFechaDisplay,
  toCertificatePdfViewModel,
} from '../pdf/certificate-pdf.mapper.js';

const base = (): CertificateRequest => ({
  id: '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
  numero: 'SOL-0001',
  estado: 'REALIZADA',
  fechaAlta: '2026-10-11T21:20:00Z',
  damnificado: {
    nombre: 'Lucía Fernández',
    dni: '30112456',
    telefono: null,
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
  abono: null,
  observaciones: null,
  motivoCancelacion: null,
  canceladoEn: null,
  retiradoEn: null,
  retiradoPorNombre: null,
  retiradoPorDni: null,
});

describe('certificate-pdf.mapper', () => {
  it('formatea DNI y fecha de visualización', () => {
    expect(formatDni('30112456')).toBe('30.112.456');
    expect(formatFechaDisplay('2026-10-11')).toBe('11/10/2026');
  });

  it('mapea campos comunes y póliza para SEGURO', () => {
    const view = toCertificatePdfViewModel(base());
    expect(view.solicitante).toBe('Lucía Fernández');
    expect(view.dni).toBe('30.112.456');
    expect(view.domicilio).toBe('Calle San Martín 450');
    expect(view.presentado).toBe('La Caja Seguros');
    expect(view.parte).toBe('P-2026-0142');
    expect(view.fechaDisplay).toBe('11/10/2026');
    expect(view.hora).toBe('18:20');
    expect(view.poliza).toBe('POL-998877');
    expect(view.dominio).toBeNull();
    expect(view.observaciones).toBeNull();
    expect(view.filename).toBe(
      'Constancia_Lucía_Fernández_11-10-2026.pdf',
    );
  });

  it('usa observaciones persistidas o el override', () => {
    const request = base();
    request.observaciones = 'Guardada en DB';
    expect(toCertificatePdfViewModel(request).observaciones).toBe(
      'Guardada en DB',
    );
    expect(
      toCertificatePdfViewModel(request, new Date(), 'Solo para esta impresión')
        .observaciones,
    ).toBe('Solo para esta impresión');
    expect(
      toCertificatePdfViewModel(request, new Date(), null).observaciones,
    ).toBeNull();
  });

  it('incluye dominio para VEHICULAR y omite póliza en ACCION_SOCIAL', () => {
    const request = base();
    request.siniestro.tipo = 'VEHICULAR';
    request.siniestro.patenteVehiculo = 'AB123CD';
    request.constancia.destino = 'ACCION_SOCIAL';
    request.constancia.numeroPoliza = null;
    request.constancia.razonSocial = 'Acción Social Morón';

    const view = toCertificatePdfViewModel(request);
    expect(view.dominio).toBe('AB123CD');
    expect(view.poliza).toBeNull();
    expect(view.presentado).toBe('Acción Social Morón');
  });
});
