import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { fieldError } from '../common/utils/field-error.js';

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const logger = new Logger('SupabaseError');

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

/** Mensajes para claves foráneas conocidas (nombre → mensaje). */
const FOREIGN_KEY_MESSAGES: Record<string, string> = {
  modelos_vehiculo_marca_id_fkey: 'La marca indicada no existe',
  vehiculos_emergencia_tipo_id_fkey: 'El tipo de vehículo indicado no existe',
  vehiculos_emergencia_marca_id_fkey: 'La marca indicada no existe',
  vehiculos_emergencia_modelo_id_fkey: 'El modelo indicado no existe',
};

/** Mensajes para restricciones CHECK conocidas (nombre → mensaje). */
const CHECK_MESSAGES: Record<string, string> = {
  vehiculos_emergencia_patente_canonica:
    'La patente solo puede tener letras y números',
};

const GENERIC = {
  unique: 'Ya existe un registro con esos datos',
  foreignKeyInUse:
    'No se puede completar la operación porque hay datos que dependen de este registro',
  foreignKeyMissing: 'Alguno de los datos relacionados no existe',
  check: 'Los datos no cumplen las reglas de validación',
  notNull: 'Falta completar un dato obligatorio',
  invalidValue: 'Alguno de los datos tiene un formato inválido',
  unexpected: 'Ocurrió un error inesperado. Intentá de nuevo más tarde.',
} as const;

/** Nombre de la constraint según el mensaje o el detalle de Postgres. */
function constraintName(text: string): string | undefined {
  return /constraint "([^"]+)"/.exec(text)?.[1];
}

/**
 * Maps PostgREST/Postgres errors to Nest HTTP exceptions with a Spanish
 * message. Raw Postgres messages are only logged, never sent to the client.
 */
export function throwMappedSupabaseError(error: SupabaseLikeError): never {
  const raw = error.message?.trim() || 'Error de base de datos';
  const code = error.code ?? '';
  const text = `${raw} ${error.details ?? ''}`;
  const name = constraintName(text);

  // CHECK violations
  if (code === '23514' || /check constraint|violates check/i.test(raw)) {
    logger.warn(raw);
    throw new BadRequestException(
      (name && CHECK_MESSAGES[name]) ?? GENERIC.check,
    );
  }

  // NOT NULL
  if (code === '23502') {
    logger.warn(raw);
    throw new BadRequestException(GENERIC.notNull);
  }

  // Unique: field errors for vehicles, friendly names for catalogs
  if (code === '23505') {
    const known = UNIQUE_CONSTRAINTS.find(({ pattern }) => pattern.test(text));
    if (known) throw known.build();
    logger.warn(raw);
    throw new ConflictException(GENERIC.unique);
  }

  // Foreign key: row still referenced on delete, or missing reference on insert/update
  if (code === '23503') {
    logger.warn(raw);
    if (/still referenced/i.test(text)) {
      throw new ConflictException(GENERIC.foreignKeyInUse);
    }
    throw new ConflictException(
      (name && FOREIGN_KEY_MESSAGES[name]) ?? GENERIC.foreignKeyMissing,
    );
  }

  // Invalid text representation (bad uuid/enum value)
  if (code === '22P02') {
    logger.warn(raw);
    throw new BadRequestException(GENERIC.invalidValue);
  }

  // Other Postgres errors (SQLSTATE, 5 chars): log the raw text, answer generic.
  // Errors from other Supabase services (Auth, etc.) keep their message.
  if (/^[0-9A-Z]{5}$/.test(code)) {
    logger.error(`[${code}] ${raw}`);
    throw new InternalServerErrorException(GENERIC.unexpected);
  }
  throw new InternalServerErrorException(raw);
}
