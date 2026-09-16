import { describe, it, expect, beforeAll } from 'vitest';
import { HashingService } from '../hashing';

describe('HashingService — password hashing foundation', () => {
  beforeAll(async () => {
    await HashingService.init();
  });

  it('should hash password', async () => {
    const hash = await HashingService.hashPassword('test123');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(10);
    expect(HashingService.isHashed(hash)).toBe(true);
  });

  it('should verify correct password', async () => {
    const password = 'MySecurePass123';
    const hash = await HashingService.hashPassword(password);
    const valid = await HashingService.verifyPassword(hash, password);
    expect(valid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await HashingService.hashPassword('correct');
    const valid = await HashingService.verifyPassword(hash, 'wrong');
    expect(valid).toBe(false);
  });

  it('should hash and verify PIN', async () => {
    const pin = '1234';
    const hash = await HashingService.hashPin(pin);
    expect(await HashingService.verifyPin(hash, pin)).toBe(true);
    expect(await HashingService.verifyPin(hash, '0000')).toBe(false);
  });

  it('should not store plaintext', async () => {
    const password = 'plaintext123';
    const hash = await HashingService.hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });
});
