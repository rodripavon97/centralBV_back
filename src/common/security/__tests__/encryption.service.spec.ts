import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption.service.js';

const VALID_KEY = 'a'.repeat(64);

function createService(key: string | undefined) {
  return new EncryptionService({
    get: vi.fn().mockReturnValue(key),
  } as unknown as ConfigService);
}

describe('EncryptionService', () => {
  it('cifra y descifra un texto manteniendo su contenido', () => {
    const service = createService(VALID_KEY);
    const plainText = 'Dato sensible: ñandú 123';

    const encrypted = service.encrypt(plainText);

    expect(encrypted).not.toContain(plainText);
    expect(encrypted).toMatch(/^v1\./);
    expect(service.decrypt(encrypted)).toBe(plainText);
  });

  it('genera un cifrado distinto en cada operación (IV aleatorio)', () => {
    const service = createService(VALID_KEY);

    expect(service.encrypt('mismo texto')).not.toBe(
      service.encrypt('mismo texto'),
    );
  });

  it('rechaza un payload alterado (tag de autenticación de GCM)', () => {
    const service = createService(VALID_KEY);
    const [version, iv, authTag] = service.encrypt('texto').split('.');

    const tampered = [version, iv, authTag, 'dGV4dG8tYWx0ZXJhZG8='].join('.');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rechaza payloads con formato inválido', () => {
    const service = createService(VALID_KEY);

    expect(() => service.decrypt('sin-formato')).toThrow(
      'El dato cifrado tiene un formato inválido',
    );
  });

  it('exige una ENCRYPTION_KEY hexadecimal de 64 caracteres', () => {
    expect(() => createService(undefined)).toThrow('ENCRYPTION_KEY');
    expect(() => createService('clave-corta')).toThrow('ENCRYPTION_KEY');
  });
});
