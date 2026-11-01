import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ITEM_REVISION_STATUS,
  type ItemRevisionStatus,
} from '../domain/revision.enums.js';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Un ítem del checklist: estado + comentario (requerido si no es OK). */
export class ItemRevisionDto {
  @ApiProperty({ enum: ITEM_REVISION_STATUS, example: 'OK' })
  @IsIn(ITEM_REVISION_STATUS, { message: 'El estado del ítem no es válido' })
  estado: ItemRevisionStatus;

  @ApiPropertyOptional({
    example: 'Nivel bajo, recargar en 48 hs',
    description: 'Obligatorio cuando estado es ADVERTENCIA o CRITICO',
    nullable: true,
  })
  @Transform(trimOptional)
  @ValidateIf((o: ItemRevisionDto) => o.estado !== 'OK')
  @IsString()
  @IsNotEmpty({
    message: 'El comentario es obligatorio cuando el estado no es OK',
  })
  @MaxLength(500)
  comentario: string | null = null;
}

/** Body para registrar una revisión de un móvil. */
export class CreateRevisionDto {
  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem nivelAceite' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  nivelAceite: ItemRevisionDto;

  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem frenos' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  frenos: ItemRevisionDto;

  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem refrigerante' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  refrigerante: ItemRevisionDto;

  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem bateria' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  bateria: ItemRevisionDto;

  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem presionNeumaticos' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  presionNeumaticos: ItemRevisionDto;

  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem lucesYBalizas' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  lucesYBalizas: ItemRevisionDto;

  @ApiProperty({ type: ItemRevisionDto })
  @IsDefined({ message: 'Falta el ítem sirenaYComunicaciones' })
  @ValidateNested()
  @Type(() => ItemRevisionDto)
  sirenaYComunicaciones: ItemRevisionDto;

  @ApiPropertyOptional({
    example: 'Revisión de rutina post-guardia',
    nullable: true,
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentarioGeneral: string | null = null;
}
