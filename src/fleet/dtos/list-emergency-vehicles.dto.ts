import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ACTIVE_VEHICLE_STATUSES,
  type ActiveVehicleStatus,
} from '../domain/emergency-vehicle.enums.js';

const ORDER_FIELDS = ['denominacion', 'patente'] as const;

/** Query params for the active emergency vehicle list. */
export class ListEmergencyVehiclesDto {
  @ApiPropertyOptional({
    description: 'Search by denomination or license plate',
    example: 'AB123',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto' })
  @MaxLength(80, { message: 'La búsqueda no puede superar los 80 caracteres' })
  busqueda?: string;

  @ApiPropertyOptional({ enum: ACTIVE_VEHICLE_STATUSES })
  @IsOptional()
  @IsIn(ACTIVE_VEHICLE_STATUSES, { message: 'El estado no es válido' })
  estado?: ActiveVehicleStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by vehicle type id',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El tipo de vehículo no es válido' })
  tipoId?: string;

  @ApiPropertyOptional({
    enum: ORDER_FIELDS,
    default: 'denominacion',
  })
  @IsOptional()
  @IsIn(ORDER_FIELDS, {
    message: 'Solo se puede ordenar por denominación o patente',
  })
  ordenPor: 'denominacion' | 'patente' = 'denominacion';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'El orden debe ser asc o desc' })
  orden: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser 1 o mayor' })
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página debe ser un número entero' })
  @Min(1, { message: 'La cantidad por página debe ser 1 o mayor' })
  @Max(100, { message: 'La cantidad por página no puede superar 100' })
  porPagina: number = 20;
}
