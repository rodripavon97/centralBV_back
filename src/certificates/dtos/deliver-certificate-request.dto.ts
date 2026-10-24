import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const SOLO_LETRAS = /^[\p{L}' -]+$/u;

/** Data of the person who picks up the certificate (required on delivery). */
export class DeliverCertificateRequestDto {
  @ApiProperty({
    example: 'María López',
    description: 'Nombre completo de quien retira',
  })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo de quien retira es obligatorio' })
  @Matches(SOLO_LETRAS, {
    message: 'El nombre completo solo admite letras',
  })
  @MaxLength(160)
  nombreCompleto: string;

  @ApiProperty({
    example: '30112456',
    description: 'DNI de quien retira (7 u 8 dígitos, sin puntos)',
  })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El DNI de quien retira es obligatorio' })
  @Matches(/^\d{7,8}$/, {
    message: 'El DNI debe tener 7 u 8 dígitos, sin puntos',
  })
  dni: string;
}
