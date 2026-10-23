import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ESTADOS_SOLICITUD } from '../domain/solicitud.entity.js';
import type { EstadoSolicitud } from '../domain/solicitud.entity.js';

/** Query del listado (US09). */
export class ListarSolicitudesDto {
  @ApiPropertyOptional({ description: 'DNI, n.º de solicitud o nombre y apellido', example: '30.112.456' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busqueda?: string;

  @ApiPropertyOptional({ enum: ESTADOS_SOLICITUD })
  @IsOptional()
  @IsIn(ESTADOS_SOLICITUD, { message: 'El estado no es válido' })
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({ enum: ['desc', 'asc'], default: 'desc', description: 'Por fecha de alta' })
  @IsOptional()
  @IsIn(['desc', 'asc'])
  orden: 'desc' | 'asc' = 'desc';

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
