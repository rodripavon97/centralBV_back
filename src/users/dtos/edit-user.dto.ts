import { PartialType } from '@nestjs/swagger';
import { UserBaseDto } from './user-base.dto.js';

export class EditUserDto extends PartialType(UserBaseDto) {
  /**
   * Construye un `EditUserDto` a partir de otro DTO u objeto con los mismos
   * campos editables. Deja fuera cualquier dato que no sea de la ficha del
   * usuario (por ejemplo, `password`) y no copia campos `undefined`.
   */
  static fromDto(source: Partial<EditUserDto>): EditUserDto {
    const dto = new EditUserDto();

    if (source.nombre !== undefined) dto.nombre = source.nombre;
    if (source.apellido !== undefined) dto.apellido = source.apellido;
    if (source.email !== undefined) dto.email = source.email;
    if (source.roleName !== undefined) dto.roleName = source.roleName;

    return dto;
  }
}
