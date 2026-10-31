// user-detail.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UserBaseDto } from './user-base.dto.js';
import { UserRow } from '../repositories/users.interfaces.type.js';
import { User } from '../domain/user.entity.js';

export class UserDetailDto extends UserBaseDto {
  @ApiProperty({ example: 'ef98fa75-45ad-4067-b5dc-d00c4bed38af' })
  id: string;

  @ApiProperty({ example: ['AUTOMOTORES'], type: [String] })
  roles: string[];

  static fromRow(row: UserRow): UserDetailDto {
    const dto = new UserDetailDto();
    dto.id = row.id;
    dto.email = row.email;
    dto.nombre = row.nombre;
    dto.apellido = row.apellido;
    dto.roles = row.roles
      .map((ur) => ur.roles?.nombre)
      .filter((nombre): nombre is string => Boolean(nombre));
    return dto;
  }

  static fromUser(user: User): UserDetailDto {
    const dto = new UserDetailDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.nombre = user.nombre;
    dto.apellido = user.apellido;
    dto.roles = user.roles ?? [];
    return dto;
  }
}
