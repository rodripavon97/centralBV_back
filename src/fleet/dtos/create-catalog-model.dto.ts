import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Body to create a model linked to a brand. */
export class CreateCatalogModelDto {
  @ApiProperty({ example: 'Ranger' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El valor es obligatorio' })
  @MaxLength(120)
  valor: string;

  @ApiProperty({ format: 'uuid', description: 'Brand id' })
  @IsUUID('4')
  marcaId: string;
}
