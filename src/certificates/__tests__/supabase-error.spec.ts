import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { throwMappedSupabaseError } from '../repositories/supabase-error.js';

describe('throwMappedSupabaseError', () => {
  it('mapea violaciones de CHECK a BadRequestException', () => {
    expect(() =>
      throwMappedSupabaseError({
        code: '23514',
        message: 'violates check constraint abonado_con_monto',
      }),
    ).toThrow(BadRequestException);
  });

  it('mapea unique/FK a ConflictException', () => {
    expect(() =>
      throwMappedSupabaseError({ code: '23505', message: 'duplicate key' }),
    ).toThrow(ConflictException);
  });

  it('mapea el resto a InternalServerErrorException', () => {
    expect(() =>
      throwMappedSupabaseError({ message: 'connection reset' }),
    ).toThrow(InternalServerErrorException);
  });
});
