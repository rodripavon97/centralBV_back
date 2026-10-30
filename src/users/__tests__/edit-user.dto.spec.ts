import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EditUserDto } from '../dtos/edit-user.dto.js';

describe('EditUserDto', () => {
  const validateDto = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(EditUserDto, data);
    return validate(dto);
  };

  const hasError = (
    errors: Awaited<ReturnType<typeof validate>>,
    property: string,
  ) => errors.some((e) => e.property === property);

  // ─── FROM DTO ─────────────────────────────────────────────────

  describe('fromDto', () => {
    it('crea una instancia de EditUserDto con los campos editables', () => {
      const dto = EditUserDto.fromDto({
        nombre: 'Ana',
        apellido: 'Lopez',
        email: 'ana@centralbv.com',
        roleName: 'comun',
      });

      expect(dto).toBeInstanceOf(EditUserDto);
      expect(dto).toEqual({
        nombre: 'Ana',
        apellido: 'Lopez',
        email: 'ana@centralbv.com',
        roleName: 'comun',
      });
    });

    it('ignora la contraseña aunque venga en el origen', () => {
      const source = {
        nombre: 'Ana',
        password: 'Nueva123!',
      } as unknown as Partial<EditUserDto>;

      const dto = EditUserDto.fromDto(source);

      expect(dto.nombre).toBe('Ana');
      expect(dto).not.toHaveProperty('password');
    });

    it('no copia propiedades undefined', () => {
      const dto = EditUserDto.fromDto({ nombre: 'Ana', apellido: undefined });

      expect(dto).toEqual({ nombre: 'Ana' });
      expect(dto.apellido).toBeUndefined();
    });

    it('permite editar un solo campo', () => {
      const dto = EditUserDto.fromDto({ email: 'nueva@centralbv.com' });

      expect(dto.email).toBe('nueva@centralbv.com');
      expect(dto.nombre).toBeUndefined();
      expect(dto.apellido).toBeUndefined();
      expect(dto.roleName).toBeUndefined();
    });
  });

  // ─── VALIDACIÓN PARCIAL ───────────────────────────────────────

  describe('validación', () => {
    it('acepta un payload vacío porque todos los campos son opcionales', async () => {
      expect(await validateDto({})).toHaveLength(0);
    });

    it('acepta cambios parciales válidos', async () => {
      const errors = await validateDto({
        nombre: 'María José',
        email: 'maria@centralbv.com',
        roleName: 'automotores',
      });
      expect(errors).toHaveLength(0);
    });

    it('rechaza un email inválido', async () => {
      const errors = await validateDto({ email: 'no-email' });
      expect(hasError(errors, 'email')).toBe(true);
    });

    it('rechaza un nombre con números', async () => {
      const errors = await validateDto({ nombre: 'Ana123' });
      expect(hasError(errors, 'nombre')).toBe(true);
    });

    it('rechaza un rol no permitido', async () => {
      const errors = await validateDto({ roleName: 'superadmin' });
      expect(hasError(errors, 'roleName')).toBe(true);
    });

    it('rechaza un email vacío', async () => {
      const errors = await validateDto({ email: '' });
      expect(hasError(errors, 'email')).toBe(true);
    });
  });
});
