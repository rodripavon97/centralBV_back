import { BadRequestException } from '@nestjs/common';
import { parseIdPipe } from '../pipes/parse-id.pipe.js';

describe('parseIdPipe', () => {
  const metadata = { type: 'param' as const, data: 'id' };

  it('deja pasar un UUID válido', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    await expect(parseIdPipe().transform(id, metadata)).resolves.toBe(id);
  });

  it('rechaza un id que no es UUID con el mensaje en español (US06: "Móvil no encontrado")', async () => {
    const result = parseIdPipe().transform('abc', metadata);
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(parseIdPipe().transform('abc', metadata)).rejects.toThrow(
      'El identificador no es válido',
    );
  });
});
