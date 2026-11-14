import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  COMPARTMENT_STATUSES,
  type CompartmentStatus,
} from '../domain/compartment.enums.js';

/** Body to change a compartment's status (any signed-in user). */
export class UpdateCompartmentStatusDto {
  @ApiProperty({ enum: COMPARTMENT_STATUSES, example: 'FUERA_DE_USO' })
  @IsIn(COMPARTMENT_STATUSES, { message: 'Elegí un estado válido' })
  estado: CompartmentStatus;
}
