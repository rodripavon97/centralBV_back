import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from '../dtos/create-user.dto.js';

describe('CreateUserDto', () => {
  const valid = (): Record<string, unknown> => ({
    nombre: 'Juan',
    apellido: 'Perez',
    email: 'juan@centralbv.com',
    password: 'Temporal123!',
    roleName: 'administrativo',
  });

  const validateDto = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(CreateUserDto, data);
    return validate(dto);
  };

  const hasError = (
    errors: Awaited<ReturnType<typeof validate>>,
    property: string,
  ) => errors.some((e) => e.property === property);

  // ─── PAYLOAD VÁLIDO ────────────────────────────────────────────

  it('acepta un payload válido completo', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  // ─── NOMBRE Y APELLIDO OBLIGATORIOS ───────────────────────────

  describe('nombre y apellido obligatorios', () => {
    it('rechaza nombre vacío', async () => {
      const errors = await validateDto({ ...valid(), nombre: '' });
      expect(hasError(errors, 'nombre')).toBe(true);
    });

    it('rechaza apellido vacío', async () => {
      const errors = await validateDto({ ...valid(), apellido: '' });
      expect(hasError(errors, 'apellido')).toBe(true);
    });

    it('rechaza cuando falta nombre (undefined)', async () => {
      const { nombre: _, ...sinNombre } = valid();
      const errors = await validateDto(sinNombre);
      expect(hasError(errors, 'nombre')).toBe(true);
    });

    it('rechaza cuando falta apellido (undefined)', async () => {
      const { apellido: _, ...sinApellido } = valid();
      const errors = await validateDto(sinApellido);
      expect(hasError(errors, 'apellido')).toBe(true);
    });
  });

  // ─── NOMBRE Y APELLIDO SOLO TEXTO (SIN NÚMEROS) ──────────────

  describe('nombre y apellido solo aceptan letras', () => {
    it('rechaza nombre con números', async () => {
      const errors = await validateDto({ ...valid(), nombre: 'Juan123' });
      expect(hasError(errors, 'nombre')).toBe(true);
    });

    it('rechaza apellido con números', async () => {
      const errors = await validateDto({ ...valid(), apellido: 'Perez456' });
      expect(hasError(errors, 'apellido')).toBe(true);
    });

    it('rechaza nombre que es solo un número', async () => {
      const errors = await validateDto({ ...valid(), nombre: '12345' });
      expect(hasError(errors, 'nombre')).toBe(true);
    });

    it('rechaza apellido que es solo un número', async () => {
      const errors = await validateDto({ ...valid(), apellido: '67890' });
      expect(hasError(errors, 'apellido')).toBe(true);
    });

    it('rechaza nombre con caracteres especiales', async () => {
      const errors = await validateDto({ ...valid(), nombre: 'Juan@#' });
      expect(hasError(errors, 'nombre')).toBe(true);
    });

    it('rechaza apellido con caracteres especiales', async () => {
      const errors = await validateDto({ ...valid(), apellido: 'Perez!' });
      expect(hasError(errors, 'apellido')).toBe(true);
    });

    it('acepta nombre con acentos y ñ', async () => {
      const errors = await validateDto({ ...valid(), nombre: 'María José' });
      expect(errors).toHaveLength(0);
    });

    it('acepta apellido con acentos y ñ', async () => {
      const errors = await validateDto({ ...valid(), apellido: 'Muñoz Peña' });
      expect(errors).toHaveLength(0);
    });
  });

  // ─── FORMATO DE EMAIL ─────────────────────────────────────────

  describe('formato de email', () => {
    it('rechaza email sin @', async () => {
      const errors = await validateDto({ ...valid(), email: 'juancentral.com' });
      expect(hasError(errors, 'email')).toBe(true);
    });

    it('rechaza email sin dominio', async () => {
      const errors = await validateDto({ ...valid(), email: 'juan@' });
      expect(hasError(errors, 'email')).toBe(true);
    });

    it('rechaza texto que no es email', async () => {
      const errors = await validateDto({ ...valid(), email: 'no-email' });
      expect(hasError(errors, 'email')).toBe(true);
    });

    it('rechaza email vacío', async () => {
      const errors = await validateDto({ ...valid(), email: '' });
      expect(hasError(errors, 'email')).toBe(true);
    });

    it('acepta email válido con subdominio', async () => {
      const errors = await validateDto({
        ...valid(),
        email: 'juan@mail.centralbv.com',
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ─── CONTRASEÑA TEMPORAL ──────────────────────────────────────

  describe('contraseña temporal con mayúscula, minúscula y número', () => {
    it('rechaza contraseña sin mayúscula', async () => {
      const errors = await validateDto({ ...valid(), password: 'temporal123!' });
      expect(hasError(errors, 'password')).toBe(true);
    });

    it('rechaza contraseña sin minúscula', async () => {
      const errors = await validateDto({ ...valid(), password: 'TEMPORAL123!' });
      expect(hasError(errors, 'password')).toBe(true);
    });

    it('rechaza contraseña sin número', async () => {
      const errors = await validateDto({ ...valid(), password: 'TemporalABC!' });
      expect(hasError(errors, 'password')).toBe(true);
    });

    it('rechaza contraseña menor a 8 caracteres', async () => {
      const errors = await validateDto({ ...valid(), password: 'Ab1!' });
      expect(hasError(errors, 'password')).toBe(true);
    });

    it('acepta contraseña válida con mayúscula, minúscula y número (8+ chars)', async () => {
      const errors = await validateDto({ ...valid(), password: 'Segura99x' });
      expect(errors).toHaveLength(0);
    });
  });

  // ─── ROLES PERMITIDOS ─────────────────────────────────────────

  describe('roles permitidos: administrativo, comun, automotores, admin', () => {
    it.each(['administrativo', 'comun', 'automotores', 'admin'])(
      'acepta el rol "%s"',
      async (rol) => {
        const errors = await validateDto({ ...valid(), roleName: rol });
        expect(errors).toHaveLength(0);
      },
    );

    it('rechaza un rol no permitido', async () => {
      const errors = await validateDto({ ...valid(), roleName: 'superadmin' });
      expect(hasError(errors, 'roleName')).toBe(true);
    });

    it('rechaza rol en mayúsculas (ADMINISTRATIVO)', async () => {
      const errors = await validateDto({ ...valid(), roleName: 'ADMINISTRATIVO' });
      expect(hasError(errors, 'roleName')).toBe(true);
    });

    it('rechaza rol vacío', async () => {
      const errors = await validateDto({ ...valid(), roleName: '' });
      expect(hasError(errors, 'roleName')).toBe(true);
    });

    it('rechaza rol arbitrario', async () => {
      const errors = await validateDto({ ...valid(), roleName: 'gerente' });
      expect(hasError(errors, 'roleName')).toBe(true);
    });
  });
});
