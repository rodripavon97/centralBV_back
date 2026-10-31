import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Body to create an emergency vehicle (always starts as OPERATIVO). */
export class CreateEmergencyVehicleDto {
  @ApiProperty({
    example: 'AB 123 CD',
    description: 'Se guarda en forma canónica (AB123CD)',
  })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'La patente es obligatoria' })
  @MaxLength(20)
  patente: string;

  @ApiProperty({ example: 'M-1' })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'La denominación es obligatoria' })
  @MaxLength(160)
  denominacion: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  tipoId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  marcaId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  modeloId: string;

  @ApiPropertyOptional({
    description:
      'true para guardar una patente que no coincide con ningún formato argentino conocido',
  })
  @IsOptional()
  @IsBoolean({ message: 'confirmarPatenteEspecial debe ser verdadero o falso' })
  confirmarPatenteEspecial?: boolean;
}
