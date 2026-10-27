import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Optional body when marking a pending request as REALIZADA. */
export class RealizeCertificateRequestDto {
  @ApiPropertyOptional({
    example: 'Se acompañan fotografías del lugar del hecho.',
    description: 'Optional text printed on the certificate',
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones: string | null = null;
}
