import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  const validateDto = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(LoginDto, data);
    return validate(dto);
  };

  it('acepta un email válido y una contraseña de al menos 8 caracteres', async () => {
    const errors = await validateDto({
      email: 'admin@centralbv.com',
      password: 'Admin123!',
    });

    expect(errors).toHaveLength(0);
  });

  it('rechaza un email con formato inválido', async () => {
    const errors = await validateDto({
      email: 'correo-invalido',
      password: 'Admin123!',
    });

    const emailError = errors.find((error) => error.property === 'email');
    expect(emailError).toBeDefined();
    expect(emailError?.constraints).toHaveProperty('isEmail');
  });

  it('rechaza una contraseña de menos de 8 caracteres', async () => {
    const errors = await validateDto({
      email: 'admin@centralbv.com',
      password: 'Abc123',
    });

    const passwordError = errors.find((error) => error.property === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError?.constraints).toHaveProperty('minLength');
  });

  it('acepta una contraseña de exactamente 8 caracteres', async () => {
    const errors = await validateDto({
      email: 'admin@centralbv.com',
      password: 'Abc12345',
    });

    expect(errors).toHaveLength(0);
  });
});
