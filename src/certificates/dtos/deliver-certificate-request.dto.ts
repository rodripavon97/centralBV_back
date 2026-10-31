import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const LETTERS_ONLY = /^[\p{L}' -]+$/u;

/** Data of the person who picks up the certificate (required on delivery). */
export class DeliverCertificateRequestDto {
  @ApiProperty({
    example: 'María López',
    description: 'Full name of the person picking up',
  })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo de quien retira es obligatorio' })
  @Matches(LETTERS_ONLY, {
    message: 'El nombre completo solo admite letras',
  })
  @MaxLength(160)
  nombreCompleto: string;

  @ApiProperty({
    example: '30112456',
    description: 'DNI of the person picking up (7 or 8 digits, no dots)',
  })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'El DNI de quien retira es obligatorio' })
  @Matches(/^\d{7,8}$/, {
    message: 'El DNI debe tener 7 u 8 dígitos, sin puntos',
  })
  dni: string;
}
