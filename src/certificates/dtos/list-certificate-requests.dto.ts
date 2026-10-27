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
  ACTIVE_REQUEST_STATUSES,
  type ActiveRequestStatus,
} from '../domain/certificate-request.enums.js';

/** Query params for the active request list (US09). Excludes RETIRADA. */
export class ListCertificateRequestsDto {
  @ApiPropertyOptional({
    description: 'DNI, request number, or victim name',
    example: '30.112.456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busqueda?: string;

  @ApiPropertyOptional({ enum: ACTIVE_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(ACTIVE_REQUEST_STATUSES, { message: 'El estado no es válido' })
  estado?: ActiveRequestStatus;

  @ApiPropertyOptional({
    enum: ['desc', 'asc'],
    default: 'desc',
    description: 'By created-at date',
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
