import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query params for a vehicle's inspection history. */
export class ListRevisionsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser 1 o mayor' })
  pagina: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página debe ser un número entero' })
  @Min(1, { message: 'La cantidad por página debe ser 1 o mayor' })
  @Max(50, { message: 'La cantidad por página no puede superar 50' })
  porPagina: number = 10;
}
