import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelarSolicitudDto {
  @ApiProperty({ example: 'El pedido no corresponde a una intervención del cuartel.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la cancelación es obligatorio' })
  @MaxLength(500)
  motivo: string;
}
