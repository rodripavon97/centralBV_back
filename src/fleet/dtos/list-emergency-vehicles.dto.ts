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
  @IsString()
  @MaxLength(80)
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
  @IsUUID('4')
  tipoId?: string;

  @ApiPropertyOptional({
    enum: ORDER_FIELDS,
    default: 'denominacion',
  })
  @IsOptional()
  @IsIn(ORDER_FIELDS)
  ordenPor: 'denominacion' | 'patente' = 'denominacion';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  orden: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  porPagina: number = 20;
}
