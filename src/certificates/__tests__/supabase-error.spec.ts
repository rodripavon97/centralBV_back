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

  const messageOf = (fn: () => never) => {
    try {
      fn();
    } catch (e) {
      return (e as Error).message;
    }
    return undefined;
  };

  it('usa un mensaje genérico en español para constraints desconocidas', () => {
    expect(
      messageOf(() =>
        throwMappedSupabaseError({
          code: '23505',
          message: 'duplicate key value violates unique constraint "otra"',
        }),
      ),
    ).toBe('Ya existe un registro con esos datos');
  });

  it('traduce la patente que no es canónica', () => {
    expect(
      messageOf(() =>
        throwMappedSupabaseError({
          code: '23514',
          message:
            'new row violates check constraint "vehiculos_emergencia_patente_canonica"',
        }),
      ),
    ).toBe('La patente solo puede tener letras y números');
  });

  it('distingue FK en uso de FK inexistente', () => {
    expect(
      messageOf(() =>
        throwMappedSupabaseError({
          code: '23503',
          message:
            'update or delete on table "x" violates foreign key constraint',
          details: 'Key (id)=(1) is still referenced from table "y".',
        }),
      ),
    ).toMatch(/hay datos que dependen/);
    expect(
      messageOf(() =>
        throwMappedSupabaseError({
          code: '23503',
          message:
            'insert or update on table "modelos_vehiculo" violates foreign key constraint "modelos_vehiculo_marca_id_fkey"',
        }),
      ),
    ).toBe('La marca indicada no existe');
  });

  it('no expone el mensaje crudo de errores inesperados de Postgres', () => {
    expect(
      messageOf(() =>
        throwMappedSupabaseError({
          code: '42P01',
          message: 'relation "x" does not exist',
        }),
      ),
    ).toBe('Ocurrió un error inesperado. Intentá de nuevo más tarde.');
  });

  it('mapea valores con formato inválido a BadRequestException', () => {
    expect(() =>
      throwMappedSupabaseError({
        code: '22P02',
        message: 'invalid input syntax',
      }),
    ).toThrow(BadRequestException);
  });
});
