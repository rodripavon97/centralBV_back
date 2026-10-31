import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body to create a type or brand catalog entry. */
export class CreateCatalogItemDto {
  @ApiProperty({ example: 'Ambulancia' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El valor es obligatorio' })
  @MaxLength(120)
  valor: string;
}
