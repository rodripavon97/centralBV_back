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
import { TIPOS_SINIESTRO } from '../domain/solicitud.entity.js';
import type { TipoSiniestro } from '../domain/solicitud.entity.js';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Un opcional vacío se guarda como NULL.
const recortarOpcional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const SOLO_LETRAS = /^[\p{L}' -]+$/u;

export class DamnificadoDto {
  @ApiProperty({ example: 'Lucía' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Matches(SOLO_LETRAS, { message: 'El nombre solo admite letras' })
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'Fernández' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @Matches(SOLO_LETRAS, { message: 'El apellido solo admite letras' })
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ example: '30112456', description: '7 u 8 dígitos, sin puntos' })
  @Transform(recortar)
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos, sin puntos' })
  dni: string;

  @ApiPropertyOptional({ example: '11 5555-0142' })
  @Transform(recortarOpcional)
  @IsOptional()
  @IsString()
  @Matches(/^(?=(?:\D*\d){6})[\d\s()+-]{6,20}$/, { message: 'El teléfono no es válido' })
  telefono: string | null = null;

  @ApiPropertyOptional({ example: 'Calle San Martín 450' })
  @Transform(recortarOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  domicilio: string | null = null;
}

export class SiniestroDto {
  @ApiProperty({ enum: TIPOS_SINIESTRO, example: 'VIVIENDA' })
  @IsIn(TIPOS_SINIESTRO, { message: 'El tipo de siniestro no es válido' })
  tipo: TipoSiniestro;

  @ApiProperty({ example: '2026-10-11T18:20', description: 'Hora local de Argentina' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: 'La fecha y hora debe tener el formato AAAA-MM-DDTHH:mm' })
  fechaHora: string;

  @ApiProperty({ example: 'Calle San Martín 450' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El lugar es obligatorio' })
  @MaxLength(160)
  lugar: string;

  @ApiProperty({ example: 'Incendio en cocina, se evacuaron 4 personas.' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(2000)
  descripcion: string;
}

/** Cuerpo del alta (US08) y de la edición (US13): siempre la solicitud completa. */
export class GuardarSolicitudDto {
  @ApiProperty({ type: DamnificadoDto })
  @IsDefined({ message: 'Faltan los datos del damnificado' })
  @ValidateNested()
  @Type(() => DamnificadoDto)
  damnificado: DamnificadoDto;

  @ApiProperty({ type: SiniestroDto })
  @IsDefined({ message: 'Faltan los datos del siniestro' })
  @ValidateNested()
  @Type(() => SiniestroDto)
  siniestro: SiniestroDto;
}
