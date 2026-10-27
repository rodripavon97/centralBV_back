import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from '../dtos/create-user.dto.js';

describe('CreateUserDto', () => {
  const valid = () => ({
    nombre: 'Juan',
    apellido: 'Perez',
    email: 'juan@centralbv.com',
    password: 'Temporal123!',
    roleName: 'ADMINISTRATIVO',
  });

  const validateDto = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(CreateUserDto, data);
    return validate(dto);
  };

  it('acepta un payload válido', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('rechaza email inválido', async () => {
    const errors = await validateDto({ ...valid(), email: 'no-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rechaza contraseña corta o sin complejidad', async () => {
    const short = await validateDto({ ...valid(), password: 'Abc1' });
    expect(short.some((e) => e.property === 'password')).toBe(true);

    const weak = await validateDto({ ...valid(), password: 'abcdefgh' });
    expect(weak.some((e) => e.property === 'password')).toBe(true);
  });

  it('exige nombre, apellido y rol', async () => {
    const errors = await validateDto({
      ...valid(),
      nombre: '',
      apellido: '',
      roleName: '',
    });
    expect(errors.map((e) => e.property).sort()).toEqual(
      expect.arrayContaining(['nombre', 'apellido', 'roleName']),
    );
  });
});
