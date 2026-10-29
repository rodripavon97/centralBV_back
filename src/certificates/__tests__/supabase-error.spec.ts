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

  it('maps the plate unique constraint to a field error', () => {
    try {
      throwMappedSupabaseError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "vehiculos_emergencia_patente_key"',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toEqual({
        message: 'Ya existe un móvil con esa patente',
        campo: 'patente',
        code: 'PATENTE_DUPLICADA',
      });
      return;
    }
    throw new Error('se esperaba un error');
  });

  it('maps the active denomination index to a field error', () => {
    try {
      throwMappedSupabaseError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "idx_vehiculos_emergencia_denominacion_activa"',
      });
    } catch (e) {
      expect((e as ConflictException).getResponse()).toEqual(
        expect.objectContaining({
          campo: 'denominacion',
          code: 'DENOMINACION_DUPLICADA',
        }),
      );
      return;
    }
    throw new Error('se esperaba un error');
  });

  it('maps catalog name duplicates to a friendly message', () => {
    expect(() =>
      throwMappedSupabaseError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "idx_marcas_vehiculo_valor_ci"',
      }),
    ).toThrow('Ya existe una marca con ese nombre (puede estar desactivada)');
  });
});
