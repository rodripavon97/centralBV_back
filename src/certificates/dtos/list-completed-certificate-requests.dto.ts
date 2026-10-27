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

/**
 * Query params for the completed (RETIRADA) request list.
 * Same pagination, search and ordering as the active list, without a status filter.
 */
export class ListCompletedCertificateRequestsDto {
  @ApiPropertyOptional({
    description: 'DNI, request number, or victim name',
    example: '30.112.456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busqueda?: string;

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
