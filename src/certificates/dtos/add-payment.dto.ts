import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../domain/certificate-request.enums.js';

/** Statuses used when registering a payment (PENDIENTE clears a loaded payment). */
export const ADD_PAYMENT_STATUSES = ['PENDIENTE', 'ABONADO', 'EXENTO'] as const;
export type AddPaymentStatus = (typeof ADD_PAYMENT_STATUSES)[number];

/** Body to register or edit a fee payment (abono). */
export class AddPaymentDto {
  @ApiProperty({
    enum: ADD_PAYMENT_STATUSES,
    example: 'ABONADO',
    description: 'PENDIENTE, ABONADO o EXENTO',
  })
  @IsIn(ADD_PAYMENT_STATUSES, {
    message: 'El estado del abono debe ser PENDIENTE, ABONADO o EXENTO',
  })
  estado: AddPaymentStatus;

  @ApiPropertyOptional({
    example: 1500,
    description: 'Required for ABONADO; omit for EXENTO',
  })
  @ValidateIf((o: AddPaymentDto) => o.estado === 'ABONADO')
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con hasta 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto?: number;

  @ApiPropertyOptional({
    enum: PAYMENT_METHODS,
    example: 'EFECTIVO',
    description: 'Required for ABONADO; omit for EXENTO',
  })
  @ValidateIf((o: AddPaymentDto) => o.estado === 'ABONADO')
  @IsIn(PAYMENT_METHODS, { message: 'El método de pago no es válido' })
  metodoPago?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Beneficiario de acción social',
    description: 'Required when status is EXENTO',
  })
  @ValidateIf((o: AddPaymentDto) => o.estado === 'EXENTO')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la exención es obligatorio' })
  @MaxLength(500)
  motivoExento?: string;
}
