// Dịch vụ mã hóa và giải mã mật khẩu tài khoản SQL Server (SAP) bằng AES-256-GCM.
// Khóa 32 byte được đọc một lần từ SAP_CREDENTIAL_KEY và giữ trong bộ nhớ.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.schema';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;
const UNCONFIGURED_KEY_MESSAGE = 'Máy chủ chưa cấu hình khóa mã hóa kết nối SAP';
const DECRYPT_FAILED_MESSAGE =
  'Không giải mã được mật khẩu đã lưu, hãy nhập lại mật khẩu cho kết nối này';

@Injectable()
export class SapCredentialCipherService {
  private readonly key: Buffer | null;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const rawKey = this.configService.get('SAP_CREDENTIAL_KEY', { infer: true });
    this.key =
      typeof rawKey === 'string' && rawKey.length > 0 ? Buffer.from(rawKey, 'base64') : null;
  }

  assertConfigured(): void {
    if (!this.key) {
      throw new ServiceUnavailableException(UNCONFIGURED_KEY_MESSAGE);
    }
  }

  encrypt(plain: string): string {
    this.assertConfigured();
    const iv = randomBytes(IV_BYTE_LENGTH);
    const cipher = createCipheriv(CIPHER_ALGORITHM, this.key!, iv, {
      authTagLength: AUTH_TAG_BYTE_LENGTH,
    });
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(stored: string): string {
    this.assertConfigured();

    const parts = stored.split('.');
    if (parts.length !== 3) {
      throw new ServiceUnavailableException(DECRYPT_FAILED_MESSAGE);
    }

    const [ivB64, tagB64, ctB64] = parts as [string, string, string];
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');

    if (iv.byteLength !== IV_BYTE_LENGTH || authTag.byteLength !== AUTH_TAG_BYTE_LENGTH) {
      throw new ServiceUnavailableException(DECRYPT_FAILED_MESSAGE);
    }

    try {
      const decipher = createDecipheriv(CIPHER_ALGORITHM, this.key!, iv, {
        authTagLength: AUTH_TAG_BYTE_LENGTH,
      });
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      throw new ServiceUnavailableException(DECRYPT_FAILED_MESSAGE);
    }
  }
}
