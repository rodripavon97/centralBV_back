import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'uuid-del-usuario' })
  @IsUUID()
  usuario_id: string;

  @ApiProperty({ example: 'uuid-del-rol' })
  @IsUUID()
  rol_id: string;
}