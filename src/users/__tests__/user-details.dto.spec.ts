import { describe, expect, it } from 'vitest';
import { User } from '../domain/user.entity.js';
import { UserDetailDto } from '../dtos/user-details.dto.js';
import type { UserRow } from '../repositories/users.interfaces.type.js';

describe('UserDetailDto', () => {
  it('incluye activo al construir desde la entidad', () => {
    const dto = UserDetailDto.fromUser(
      new User('u1', 'ana@centralbv.test', 'Ana', 'Gómez', false, undefined, [
        'ADMIN',
      ]),
    );

    expect(dto.activo).toBe(false);
    expect(dto.roles).toEqual(['ADMIN']);
  });

  it('incluye activo al construir desde la fila de Supabase', () => {
    const row: UserRow = {
      id: 'u1',
      email: 'ana@centralbv.test',
      nombre: 'Ana',
      apellido: 'Gómez',
      activo: true,
      roles: [{ roles: { nombre: 'ADMIN' } }, { roles: null }],
    };

    const dto = UserDetailDto.fromRow(row);

    expect(dto.activo).toBe(true);
    expect(dto.roles).toEqual(['ADMIN']);
  });
});
