import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

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

  // Unique / foreign key conflicts
  if (code === '23505' || code === '23503') {
    throw new ConflictException(message);
  }

  throw new InternalServerErrorException(message);
}
