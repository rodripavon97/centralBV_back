import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { fieldError } from '../common/utils/field-error.js';

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

/** Mensajes amigables para restricciones UNIQUE conocidas (por nombre). */
const UNIQUE_CONSTRAINTS: {
  pattern: RegExp;
  build: () => ConflictException;
}[] = [
  {
    pattern: /vehiculos_emergencia_patente_key/,
    build: () =>
      new ConflictException(
        fieldError(
          'patente',
          'PATENTE_DUPLICADA',
          'Ya existe un móvil con esa patente',
        ),
      ),
  },
  {
    pattern: /idx_vehiculos_emergencia_denominacion_activa/,
    build: () =>
      new ConflictException(
        fieldError(
          'denominacion',
          'DENOMINACION_DUPLICADA',
          'Ya existe un móvil con esa denominación',
        ),
      ),
  },
  {
    pattern: /tipos_vehiculo_valor/,
    build: () =>
      new ConflictException(
        'Ya existe un tipo con ese nombre (puede estar desactivado)',
      ),
  },
  {
    pattern: /marcas_vehiculo_valor/,
    build: () =>
      new ConflictException(
        'Ya existe una marca con ese nombre (puede estar desactivada)',
      ),
  },
  {
    pattern: /modelos_vehiculo_marca_id_valor|modelos_vehiculo_valor/,
    build: () =>
      new ConflictException(
        'Ya existe un modelo con ese nombre para esa marca (puede estar desactivado)',
      ),
  },
];

/** Maps PostgREST/Postgres errors to Nest HTTP exceptions. */
export function throwMappedSupabaseError(error: SupabaseLikeError): never {
  const message = error.message?.trim() || 'Error de base de datos';
  const code = error.code ?? '';

  // CHECK / NOT NULL / etc. violations
  if (
    code === '23514' ||
    code === '23502' ||
    /check constraint|violates check/i.test(message)
  ) {
    throw new BadRequestException(message);
  }

  if (code === '23505') {
    const known = UNIQUE_CONSTRAINTS.find(({ pattern }) =>
      pattern.test(`${message} ${error.details ?? ''}`),
    );
    if (known) throw known.build();
  }

  // Unique / foreign key conflicts
  if (code === '23505' || code === '23503') {
    throw new ConflictException(message);
  }

  throw new InternalServerErrorException(message);
}
