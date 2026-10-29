import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** ParseUUIDPipe with a Spanish error message for route ids. */
export const parseIdPipe = () =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException('El identificador no es válido'),
  });
