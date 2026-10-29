import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({ example: 'carlos@centralbv.com' })
  email: string;

  @ApiProperty({ example: 'Carlos' })
  nombre: string;

  @ApiProperty({ example: 'Romero' })
  apellido: string;

  @ApiProperty({ example: true })
  activo: boolean;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Identificador de Google si la cuenta se creó con OAuth',
  })
  googleSub?: string;

  @ApiProperty({
    example: ['ADMINISTRATIVO', 'COMUN'],
    type: [String],
    description: 'Roles asignados al usuario',
  })
  roles: string[];
}
