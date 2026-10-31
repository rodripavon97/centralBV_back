import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body to permanently write off a vehicle; requires a reason. */
export class WriteOffEmergencyVehicleDto {
  @ApiProperty({
    example: 'Unidad dada de baja por fin de vida útil.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la baja es obligatorio' })
  @MaxLength(500)
  motivo: string;
}
