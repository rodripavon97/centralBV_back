import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  COMPARTMENT_NAME_MAX,
  COMPARTMENT_ZONES,
  type CompartmentZone,
} from '../domain/compartment.enums.js';
import { trimValue } from './create-compartment.dto.js';

/** Body to rename a compartment or move it to another zone (at least one field). */
export class UpdateCompartmentDto {
  @ApiPropertyOptional({ example: 'LC-2', maxLength: COMPARTMENT_NAME_MAX })
  @IsOptional()
  @Transform(trimValue)
  @IsString({ message: 'El nombre es obligatorio' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(COMPARTMENT_NAME_MAX, {
    message: `El nombre puede tener hasta ${COMPARTMENT_NAME_MAX} caracteres`,
  })
  nombre?: string;

  @ApiPropertyOptional({ enum: COMPARTMENT_ZONES })
  @IsOptional()
  @IsIn(COMPARTMENT_ZONES, { message: 'Elegí una zona' })
  zona?: CompartmentZone;
}
