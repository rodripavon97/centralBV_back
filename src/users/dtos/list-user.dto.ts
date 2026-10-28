import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ListUsersDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre, apellido o email' })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({ description: 'Filtrar por nombre del rol' })
  @IsString()
  @IsOptional()
  rol?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Ordenamiento (ej: nombre.asc)' })
  @IsString()
  @IsOptional()
  orden?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pagina: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  porPagina: number = 10;
}