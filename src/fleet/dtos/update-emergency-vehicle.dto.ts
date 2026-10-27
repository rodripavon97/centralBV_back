import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Body to update general vehicle data (everything except status). */
export class UpdateEmergencyVehicleDto {
  @ApiProperty({ example: 'AB123CD' })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'La patente es obligatoria' })
  @MaxLength(20)
  patente: string;

  @ApiProperty({ example: 'Unidad 1 - Ambulancia' })
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
}
