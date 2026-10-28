import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCMTypes,
} from 'node:crypto';

const ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // recomendado para GCM
const PAYLOAD_VERSION = 'v1';

/**
 * Cifrado simétrico AES-256-GCM basado en la receta de NestJS
 * (Security > Encryption and Hashing), con IV aleatorio por operación y
 * tag de autenticación para detectar datos alterados.
 *
 * La clave se toma de `ENCRYPTION_KEY` y debe ser hexadecimal de 64
 * caracteres (32 bytes). Generarla con:
 * `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const rawKey = configService.get<string>('ENCRYPTION_KEY');
    if (!rawKey) {
      throw new Error(
        'ENCRYPTION_KEY no está configurada. Definí una clave hexadecimal de 64 caracteres.',
      );
    }
    this.key = this.parseKey(rawKey);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    return [
      PAYLOAD_VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const [version, ivBase64, authTagBase64, encryptedBase64] =
      payload.split('.');

    if (
      version !== PAYLOAD_VERSION ||
      !ivBase64 ||
      !authTagBase64 ||
      !encryptedBase64
    ) {
      throw new Error('El dato cifrado tiene un formato inválido');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private parseKey(rawKey: string): Buffer {
    const key = rawKey.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(
        'ENCRYPTION_KEY debe ser hexadecimal de 64 caracteres (32 bytes).',
      );
    }

    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== KEY_BYTES) {
      throw new Error('ENCRYPTION_KEY debe tener exactamente 32 bytes.');
    }

    return keyBuffer;
  }
}
