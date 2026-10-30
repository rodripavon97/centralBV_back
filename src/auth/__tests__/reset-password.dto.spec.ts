import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from '../dtos/resetPassword.dto.js';

describe('ResetPasswordDto', () => {
  const validateDto = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(ResetPasswordDto, data);
    return validate(dto);
  };

  it('acepta datos válidos', async () => {
    const errors = await validateDto({
      newPassword: 'Password123!',
      confirmPassword: 'Password123!',
      token: 'jwt-valid-token-123',
    });

    expect(errors).toHaveLength(0);
  });

  it('rechaza una contraseña con menos de 8 caracteres', async () => {
    const errors = await validateDto({
      newPassword: 'Pass1!',
      confirmPassword: 'Pass1!',
      token: 'jwt-valid-token-123',
    });

    const newPasswordError = errors.find((e) => e.property === 'newPassword');
    expect(newPasswordError).toBeDefined();
    expect(newPasswordError?.constraints).toHaveProperty('minLength');
  });

  it('rechaza una contraseña sin mayúscula o sin número', async () => {
    const errors = await validateDto({
      newPassword: 'passwordlowercase',
      confirmPassword: 'passwordlowercase',
      token: 'jwt-valid-token-123',
    });

    const newPasswordError = errors.find((e) => e.property === 'newPassword');
    expect(newPasswordError).toBeDefined();
    expect(newPasswordError?.constraints).toHaveProperty('matches');
  });

  it('rechaza si confirmPassword está vacío', async () => {
    const errors = await validateDto({
      newPassword: 'Password123!',
      confirmPassword: '',
      token: 'jwt-valid-token-123',
    });

    const confirmError = errors.find((e) => e.property === 'confirmPassword');
    expect(confirmError).toBeDefined();
    expect(confirmError?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rechaza si token está vacío', async () => {
    const errors = await validateDto({
      newPassword: 'Password123!',
      confirmPassword: 'Password123!',
      token: '',
    });

    const tokenError = errors.find((e) => e.property === 'token');
    expect(tokenError).toBeDefined();
    expect(tokenError?.constraints).toHaveProperty('isNotEmpty');
  });
});

