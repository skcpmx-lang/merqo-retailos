import { describe, it, expect } from 'vitest';
import { validateIpcPayload } from '../validators';

describe('Validators — IPC payload', () => {
  it('should validate known channel with valid payload', () => {
    const result = validateIpcPayload('app:getInfo', {});
    expect(result.valid).toBe(true);
  });

  it('should fail for invalid payload', () => {
    const result = validateIpcPayload('auth:login', { phone: '' });
    expect(result.valid).toBe(false);
  });

  it('should fail for unknown channel', () => {
    const result = validateIpcPayload('unknown:channel', {});
    expect(result.valid).toBe(false);
  });

  it('should validate login payload', () => {
    const valid = validateIpcPayload('auth:login', { phone: '01712345678', password: 'pass123' });
    expect(valid.valid).toBe(true);

    const invalid = validateIpcPayload('auth:login', { phone: '', password: '' });
    expect(invalid.valid).toBe(false);
  });
});
