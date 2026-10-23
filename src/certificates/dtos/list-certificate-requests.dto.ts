import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  REQUEST_STATUSES,
  type RequestStatus,
} from '../domain/certificate-request.enums.js';

/** Query params for the request list (US09). */
export class ListCertificateRequestsDto {
  @ApiPropertyOptional({
    description: 'DNI, n.º de solicitud o nombre y apellido',
    example: '30.112.456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busqueda?: string;

  @ApiPropertyOptional({ enum: REQUEST_STATUSES })
  @IsOptional()
  @IsIn(REQUEST_STATUSES, { message: 'El estado no es válido' })
  estado?: RequestStatus;

  @ApiPropertyOptional({
    enum: ['desc', 'asc'],
    default: 'desc',
    description: 'Por fecha de alta',
  })
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
