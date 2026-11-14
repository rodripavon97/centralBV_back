import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  COMPARTMENT_NAME_MAX,
  COMPARTMENT_ZONES,
  type CompartmentZone,
} from '../domain/compartment.enums.js';

export const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Body to add one compartment. It goes to the end of its zone. */
export class CreateCompartmentDto {
  @ApiProperty({ example: 'LC-6', maxLength: COMPARTMENT_NAME_MAX })
  @Transform(trimValue)
  @IsString({ message: 'El nombre es obligatorio' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(COMPARTMENT_NAME_MAX, {
    message: `El nombre puede tener hasta ${COMPARTMENT_NAME_MAX} caracteres`,
  })
  nombre: string;

  @ApiProperty({ enum: COMPARTMENT_ZONES, example: 'LADO_CONDUCTOR' })
  @IsIn(COMPARTMENT_ZONES, { message: 'Elegí una zona' })
  zona: CompartmentZone;
}
