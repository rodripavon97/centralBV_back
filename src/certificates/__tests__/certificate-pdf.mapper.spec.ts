import type { CertificateRequest } from '../domain/certificate-request.entity.js';
import {
  formatDni,
  formatDateDisplay,
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
  it('formats DNI and display date', () => {
    expect(formatDni('30112456')).toBe('30.112.456');
    expect(formatDateDisplay('2026-10-11')).toBe('11/10/2026');
  });

  it('maps common fields and policy for SEGURO', () => {
    const view = toCertificatePdfViewModel(base());
    expect(view.applicant).toBe('Lucía Fernández');
    expect(view.dni).toBe('30.112.456');
    expect(view.address).toBe('Calle San Martín 450');
    expect(view.presentedTo).toBe('La Caja Seguros');
    expect(view.reportNumber).toBe('P-2026-0142');
    expect(view.dateDisplay).toBe('11/10/2026');
    expect(view.time).toBe('18:20');
    expect(view.policyNumber).toBe('POL-998877');
    expect(view.vehiclePlate).toBeNull();
    expect(view.observations).toBeNull();
    expect(view.filename).toBe(
      'Constancia_Lucía_Fernández_11-10-2026.pdf',
    );
  });

  it('uses persisted observations or the override', () => {
    const request = base();
    request.observaciones = 'Guardada en DB';
    expect(toCertificatePdfViewModel(request).observations).toBe(
      'Guardada en DB',
    );
    expect(
      toCertificatePdfViewModel(request, new Date(), 'Solo para esta impresión')
        .observations,
    ).toBe('Solo para esta impresión');
    expect(
      toCertificatePdfViewModel(request, new Date(), null).observations,
    ).toBeNull();
  });

  it('includes vehicle plate for VEHICULAR and omits policy for ACCION_SOCIAL', () => {
    const request = base();
    request.siniestro.tipo = 'VEHICULAR';
    request.siniestro.patenteVehiculo = 'AB123CD';
    request.constancia.destino = 'ACCION_SOCIAL';
    request.constancia.numeroPoliza = null;
    request.constancia.razonSocial = 'Acción Social Morón';

    const view = toCertificatePdfViewModel(request);
    expect(view.vehiclePlate).toBe('AB123CD');
    expect(view.policyNumber).toBeNull();
    expect(view.presentedTo).toBe('Acción Social Morón');
  });
});
