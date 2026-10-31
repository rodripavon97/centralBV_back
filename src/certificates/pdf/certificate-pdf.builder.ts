import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import type { CertificatePdfViewModel } from './certificate-pdf.mapper.js';

const LOGO_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'assets',
  'jcp-headquarters-logo.jpeg',
);

function loadLogoDataUrl(): string | null {
  try {
    const bytes = readFileSync(LOGO_PATH);
    return `data:image/jpeg;base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Builds the 3-page constancia PDF (signatures only on page 1).
 * Port of the front-end jsPDF layout; returns a Buffer (no download/email).
 */
export function buildCertificatePdf(data: CertificatePdfViewModel): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth();
  const logoDataUrl = loadLogoDataUrl();

  for (let page = 1; page <= 3; page++) {
    if (page > 1) {
      doc.addPage();
    }

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'JPEG', width / 2 - 15, 10, 30, 30);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      'ASOCIACIÓN DE BOMBEROS VOLUNTARIOS DE JOSÉ C. PAZ',
      width / 2,
      45,
      { align: 'center' },
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('PERSONERÍA JURÍDICA N° 32092', width / 2, 50, {
      align: 'center',
    });
    doc.text(
      'PROVINCIA DE BUENOS AIRES - REPÚBLICA ARGENTINA',
      width / 2,
      54,
      { align: 'center' },
    );
    doc.text('I.N.O.B.V. N° 234', width / 2, 58, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(
      'Cuartel Central - Comandante Donato De Salvis',
      width / 2,
      65,
      { align: 'center' },
    );
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Pasaje San Agustín 703 (1665) José Clemente Paz - Bs. As.',
      width / 2,
      69,
      { align: 'center' },
    );
    doc.text(
      'Tel.: 02320-422222 / 02320-436736 E-mail: adbvjosecpaz@gmail.com',
      width / 2,
      73,
      { align: 'center' },
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CONSTANCIA DE SINIESTRO', width / 2, 85, { align: 'center' });
    doc.line(width / 2 - 35, 86, width / 2 + 35, 86);

    doc.setFontSize(10);
    let y = 100;
    const col1 = 20;
    const col2 = 140;

    doc.setFont('helvetica', 'bold');
    doc.text('SOLICITANTE: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.applicant.toUpperCase(), col1 + 30, y);

    doc.setFont('helvetica', 'bold');
    doc.text('DNI: ', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.dni, col2 + 10, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('DOMICILIO DEL HECHO: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.address.toUpperCase(), col1 + 45, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('LOCALIDAD: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.locality.toUpperCase(), col1 + 25, y);

    doc.setFont('helvetica', 'bold');
    doc.text('PARTIDO: ', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.district.toUpperCase(), col2 + 18, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('MOTIVO: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.reason.toUpperCase(), col1 + 18, y);

    if (data.vehiclePlate) {
      doc.setFont('helvetica', 'bold');
      doc.text('DOMINIO: ', col2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehiclePlate.toUpperCase(), col2 + 18, y);
    }

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('PERDIDAS: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.losses, col1 + 22, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('PARA SER PRESENTADO: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.presentedTo.toUpperCase(), col1 + 45, y);

    if (data.policyNumber) {
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('NÚMERO DE POLIZA: ', col1, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.policyNumber, col1 + 40, y);
    }

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('PARTE N°: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.reportNumber, col1 + 20, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.dateDisplay, col1 + 15, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('HORA: ', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.time} HS.`, col1 + 15, y);

    if (data.observations) {
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVACIONES: ', col1, y);
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(
        data.observations,
        width - 40 - 35,
      ) as string[];
      doc.text(obsLines, col1 + 35, y);
      if (obsLines.length > 1) {
        y += (obsLines.length - 1) * 5;
      }
    }

    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const introText =
      'Se deja constancia que los datos que se consignan precedentemente surgen del parte profesional del cual doy fe; teniendo validez únicamente, con titulo de propiedad o boleto de compra-venta, para el caso de siniestro sobre bienes muebles y/o inmuebles registrables.';

    const textLines = doc.splitTextToSize(introText, width - 40) as string[];
    const lineHeight = 5;

    let currentY = y;
    for (let i = 0; i < textLines.length - 1; i++) {
      doc.text(textLines[i], col1, currentY);
      currentY += lineHeight;
    }

    const lastLine = textLines[textLines.length - 1] ?? '';
    doc.text(lastLine, col1, currentY);

    const lastLineWidth = doc.getTextWidth(lastLine);
    doc.setFont('helvetica', 'bold');

    const footerWidth = doc.getTextWidth(` ${data.footerDate}`);
    if (col1 + lastLineWidth + footerWidth > width - 20) {
      currentY += lineHeight;
      doc.text(data.footerDate, col1, currentY);
    } else {
      doc.text(` ${data.footerDate}`, col1 + lastLineWidth, currentY);
    }

    y = currentY + 15;

    if (page === 1) {
      y += 30;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);

      const drawDottedLine = (
        label: string,
        startX: number,
        endX: number,
        py: number,
      ) => {
        doc.text(label, startX, py);
        let currentX = startX + doc.getTextWidth(`${label} `);
        let dots = '';
        while (currentX + doc.getTextWidth(`${dots}.`) < endX) {
          dots += '.';
        }
        doc.text(dots, currentX, py);
      };

      drawDottedLine('RETIRO:', col1, 110, y);
      drawDottedLine('DNI:', 120, width - 20, y);

      y += 10;
      drawDottedLine('FIRMA:', col1, 110, y);
      drawDottedLine('FECHA:', 120, width - 20, y);
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}
