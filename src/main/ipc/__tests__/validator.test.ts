import { describe, it, expect } from 'vitest';
import { validateChannel, validatePayload } from '../validator';

describe('IPC Validator — security foundation', () => {
  it('should allow valid channels', () => {
    expect(() => validateChannel('app:getInfo')).not.toThrow();
    expect(() => validateChannel('db:getStatus')).not.toThrow();
    expect(() => validateChannel('auth:login')).not.toThrow();
  });

  it('should block invalid channels', () => {
    expect(() => validateChannel('fs:readFile')).toThrow();
    expect(() => validateChannel('db:dropTable')).toThrow();
    expect(() => validateChannel('evil:channel')).toThrow();
  });

  it('should validate valid payload', () => {
    expect(() => validatePayload('app:getInfo', {})).not.toThrow();
    expect(() => validatePayload('auth:login', { phone: '01712345678', password: 'pass' })).not.toThrow();
  });

  it('should reject invalid payload', () => {
    expect(() => validatePayload('auth:login', { phone: '' })).toThrow();
    expect(() => validatePayload('auth:login', { phone: '017', password: '' })).toThrow();
  });

  it('should reject arbitrary IPC attempts', () => {
    // Renderer attempting restricted operation
    expect(() => validateChannel('fs:readFile')).toThrow();
    expect(() => validateChannel('child_process:exec')).toThrow();
    expect(() => validateChannel('require:module')).toThrow();
  });
});
