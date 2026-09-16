/**
 * IPC validation — no arbitrary channels, validate payloads with Zod
 */

import { z } from 'zod';
import { ALLOWED_IPC_CHANNELS, type IpcChannel } from '@shared/ipc/contracts';
import { InvalidIpcChannelError, InvalidIpcPayloadError } from '@core/domain/errors/AppError';
import { ipcPayloadSchemas } from '@core/domain/validators';

export function validateChannel(channel: string): IpcChannel {
  if (!ALLOWED_IPC_CHANNELS.includes(channel as IpcChannel)) {
    throw new InvalidIpcChannelError(channel);
  }
  return channel as IpcChannel;
}

export function validatePayload(channel: string, payload: unknown): void {
  const schema = (ipcPayloadSchemas as Record<string, z.ZodSchema>)[channel];
  if (!schema) {
    // If no schema defined, allow empty object or undefined
    // But for security, we should have schema for all channels
    // For now, allow if payload is object or undefined
    if (payload !== undefined && payload !== null && typeof payload !== 'object') {
      throw new InvalidIpcPayloadError(
        `Invalid payload for ${channel}`,
        `অনুরোধের তথ্য সঠিক নয়`
      );
    }
    return;
  }

  try {
    schema.parse(payload);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const details = e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new InvalidIpcPayloadError(
        `Validation failed for ${channel}: ${details}`,
        `অনুরোধের তথ্য যাচাই ব্যর্থ হয়েছে`,
        undefined,
        { zodErrors: e.errors }
      );
    }
    throw new InvalidIpcPayloadError(
      `Invalid payload for ${channel}: ${String(e)}`,
      `অনুরোধের তথ্য সঠিক নয়`
    );
  }
}

export function sanitizePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const sensitiveKeys = ['password', 'pin', 'password_hash', 'pin_hash', 'secret'];
  const obj = payload as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}
