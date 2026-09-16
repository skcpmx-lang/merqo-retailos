/**
 * Password and PIN hashing — argon2id preferred, bcryptjs fallback
 * Do not store plaintext
 * argon2 is optional (native module) — if not available, fallback to bcryptjs
 */

import bcrypt from 'bcryptjs';
import { logger } from '../logging/logger';

let argon2: any = null;

try {
  // Dynamic require — may fail if not installed or native build fails
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  argon2 = require('argon2');
} catch {
  argon2 = null;
  logger.warn('argon2 not available, will use bcryptjs');
}

export class HashingService {
  private static useArgon2 = !!argon2;

  static async init() {
    if (!argon2) {
      HashingService.useArgon2 = false;
      logger.info('Hashing: using bcryptjs (argon2 not available)');
      return;
    }

    // Test if argon2 works on this platform
    try {
      await argon2.hash('test', { type: argon2.argon2id, memoryCost: 1024, timeCost: 1 });
      HashingService.useArgon2 = true;
      logger.info('Hashing: using argon2id');
    } catch (e) {
      HashingService.useArgon2 = false;
      logger.warn('Hashing: argon2 failed, falling back to bcrypt', { error: String(e) });
    }
  }

  static async hashPassword(password: string): Promise<string> {
    if (HashingService.useArgon2 && argon2) {
      try {
        return await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 19456, // 19 MB
          timeCost: 2,
          parallelism: 1,
        });
      } catch (e) {
        logger.warn('argon2 hash failed, fallback to bcrypt', { error: String(e) });
        HashingService.useArgon2 = false;
      }
    }
    // bcrypt fallback
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  }

  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    // Detect hash type
    if (hash.startsWith('$argon2') && argon2) {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    } else if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      return await bcrypt.compare(password, hash);
    } else {
      // Unknown hash format or argon2 not available
      if (hash.startsWith('$argon2')) {
        logger.warn('argon2 hash found but argon2 not available, cannot verify');
        return false;
      }
      logger.warn('Unknown hash format');
      return false;
    }
  }

  static async hashPin(pin: string): Promise<string> {
    // PIN is 4-6 digits, still hash with same strength
    return HashingService.hashPassword(pin);
  }

  static async verifyPin(hash: string, pin: string): Promise<boolean> {
    return HashingService.verifyPassword(hash, pin);
  }

  static isHashed(value: string): boolean {
    return value.startsWith('$argon2') || value.startsWith('$2a$') || value.startsWith('$2b$');
  }
}
