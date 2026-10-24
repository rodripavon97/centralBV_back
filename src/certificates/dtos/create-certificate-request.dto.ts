import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ACCIDENT_TYPES,
  CERTIFICATE_DESTINATIONS,
  type AccidentType,
  type CertificateDestination,
} from '../domain/certificate-request.enums.js';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Empty optional strings are stored as NULL.
const recortarOpcional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const SOLO_LETRAS = /^[\p{L}' -]+$/u;

/** Victim (damnificado) fields for create/update. */
export class VictimDto {
  @ApiProperty({ example: 'Lucía Fernández' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Matches(SOLO_LETRAS, { message: 'El nombre solo admite letras' })
  @MaxLength(160)
  nombre: string;

  @ApiProperty({
    example: '30112456',
    description: '7 u 8 dígitos, sin puntos',
  })
  @Transform(recortar)
  @IsString()
  @Matches(/^\d{7,8}$/, {
    message: 'El DNI debe tener 7 u 8 dígitos, sin puntos',
  })
  dni: string;

  @ApiPropertyOptional({ example: '11 5555-0142' })
  @Transform(recortarOpcional)
  @IsOptional()
  @IsString()
  @Matches(/^(?=(?:\D*\d){6})[\d\s()+-]{6,20}$/, {
    message: 'El teléfono no es válido',
  })
  telefono: string | null = null;
}

/** Accident (siniestro) fields for create/update. */
export class AccidentDto {
  @ApiProperty({ enum: ACCIDENT_TYPES, example: 'VIVIENDA' })
  @IsIn(ACCIDENT_TYPES, { message: 'El tipo de siniestro no es válido' })
  tipo: AccidentType;

  @ApiProperty({ example: '2026-10-11', description: 'Fecha local de Argentina' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato AAAA-MM-DD',
  })
  fecha: string;

  @ApiProperty({ example: '18:20', description: 'Hora local de Argentina' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'La hora debe tener el formato HH:mm',
  })
  hora: string;

  @ApiProperty({ example: 'Calle San Martín 450' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @MaxLength(160)
  direccion: string;

  @ApiProperty({ example: 'P-2026-0142' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El número de parte es obligatorio' })
  @MaxLength(40)
  numeroParte: string;

  @ApiProperty({ example: 'Solicitud de constancia para el seguro' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(500)
  motivo: string;

  @ApiProperty({ example: 'Morón' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La localidad es obligatoria' })
  @MaxLength(80)
  localidad: string;

  @ApiProperty({ example: 'Morón' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El partido es obligatorio' })
  @MaxLength(80)
  partido: string;

  @ApiProperty({ example: 'Daños en cocina y artefactos' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Las pérdidas son obligatorias' })
  @MaxLength(2000)
  perdidas: string;

  @ApiPropertyOptional({
    example: 'AB123CD',
    description: 'Obligatoria si el tipo es VEHICULAR; no aplica a VIVIENDA',
  })
  @Transform(recortarOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  patenteVehiculo: string | null = null;
}

/** Certificate destination fields for create/update. */
export class CertificateDto {
  @ApiProperty({ enum: CERTIFICATE_DESTINATIONS, example: 'SEGURO' })
  @IsIn(CERTIFICATE_DESTINATIONS, {
    message: 'El destino de la constancia no es válido',
  })
  destino: CertificateDestination;

  @ApiProperty({
    example: 'La Caja Seguros',
    description: 'Nombre del seguro o de la acción social a la que se presenta',
  })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  @MaxLength(160)
  razonSocial: string;

  @ApiPropertyOptional({
    example: 'POL-998877',
    description: 'Obligatoria si el destino es SEGURO',
  })
  @Transform(recortarOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroPoliza: string | null = null;
}

/** Body for create (US08) and edit (US13): always the full request. */
export class CreateCertificateRequestDto {
  @ApiProperty({ type: VictimDto })
  @IsDefined({ message: 'Faltan los datos del damnificado' })
  @ValidateNested()
  @Type(() => VictimDto)
  damnificado: VictimDto;

  @ApiProperty({ type: AccidentDto })
  @IsDefined({ message: 'Faltan los datos del siniestro' })
  @ValidateNested()
  @Type(() => AccidentDto)
  siniestro: AccidentDto;

  @ApiProperty({ type: CertificateDto })
  @IsDefined({ message: 'Faltan los datos de la constancia' })
  @ValidateNested()
  @Type(() => CertificateDto)
  constancia: CertificateDto;
}
