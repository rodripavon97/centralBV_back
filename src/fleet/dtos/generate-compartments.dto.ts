import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { GENERATION_LIMITS } from '../domain/compartment.enums.js';

const side = `Entre 0 y ${GENERATION_LIMITS.side}`;

/** Per-zone counts for the compartment generator (Figma · Generar buches). */
export class GenerateCompartmentsDto {
  @ApiProperty({ example: 5, minimum: 0, maximum: GENERATION_LIMITS.side })
  @IsInt({ message: 'Lado conductor: indicá un número entero' })
  @Min(0, { message: `Lado conductor: ${side.toLowerCase()}` })
  @Max(GENERATION_LIMITS.side, {
    message: `Lado conductor: ${side.toLowerCase()}`,
  })
  ladoConductor: number;

  @ApiProperty({ example: 2, minimum: 0, maximum: GENERATION_LIMITS.side })
  @IsInt({ message: 'Lado acompañante: indicá un número entero' })
  @Min(0, { message: `Lado acompañante: ${side.toLowerCase()}` })
  @Max(GENERATION_LIMITS.side, {
    message: `Lado acompañante: ${side.toLowerCase()}`,
  })
  ladoAcompanante: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: GENERATION_LIMITS.rear })
  @IsInt({ message: 'Trasero: indicá un número entero' })
  @Min(0, { message: `Trasero: entre 0 y ${GENERATION_LIMITS.rear}` })
  @Max(GENERATION_LIMITS.rear, {
    message: `Trasero: entre 0 y ${GENERATION_LIMITS.rear}`,
  })
  trasero: number;

  @ApiProperty({
    example: true,
    description: 'Un buche de techo y escalas (TE-1)',
  })
  @IsBoolean({ message: 'Techo: indicá sí o no' })
  techo: boolean;

  @ApiProperty({
    example: false,
    description: 'Un buche de equipos de cabina (CB-1)',
  })
  @IsBoolean({ message: 'Cabina: indicá sí o no' })
  cabina: boolean;
}
