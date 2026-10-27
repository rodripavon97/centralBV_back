import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';

describe('throwMappedSupabaseError', () => {
  it('maps CHECK violations to BadRequestException', () => {
    expect(() =>
      throwMappedSupabaseError({
        code: '23514',
        message: 'violates check constraint abonado_con_monto',
      }),
    ).toThrow(BadRequestException);
  });

  it('maps unique/FK errors to ConflictException', () => {
    expect(() =>
      throwMappedSupabaseError({ code: '23505', message: 'duplicate key' }),
    ).toThrow(ConflictException);
  });

  it('maps everything else to InternalServerErrorException', () => {
    expect(() =>
      throwMappedSupabaseError({ message: 'connection reset' }),
    ).toThrow(InternalServerErrorException);
  });
});
