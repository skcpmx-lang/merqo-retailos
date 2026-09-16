export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_ERROR'
  | 'DATABASE_ERROR'
  | 'MIGRATION_ERROR'
  | 'HARDWARE_ERROR'
  | 'PRINTER_ERROR'
  | 'BACKUP_ERROR'
  | 'RESTORE_ERROR'
  | 'IMPORT_ERROR'
  | 'EXPORT_ERROR'
  | 'SYSTEM_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_IPC_CHANNEL'
  | 'INVALID_IPC_PAYLOAD';

export interface ErrorDetails {
  code: ErrorCode;
  message: string; // Technical message for logs (English)
  messageBn: string; // User-facing Bangla message (polished)
  correlationId?: string;
  field?: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly messageBn: string;
  public readonly correlationId: string;
  public readonly field?: string;
  public readonly details?: unknown;
  public readonly statusCode: number;

  constructor(params: ErrorDetails & { statusCode?: number }) {
    super(params.message);
    this.name = this.constructor.name;
    this.code = params.code;
    this.messageBn = params.messageBn;
    this.correlationId = params.correlationId || AppError.generateCorrelationId();
    this.field = params.field;
    this.details = params.details;
    this.statusCode = params.statusCode || 400;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static generateCorrelationId(): string {
    // Simple correlation ID: timestamp + random
    return `MERQO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  toJSON(): ErrorDetails & { correlationId: string } {
    return {
      code: this.code,
      message: this.message,
      messageBn: this.messageBn,
      correlationId: this.correlationId,
      field: this.field,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, messageBn: string, field?: string, details?: unknown, correlationId?: string) {
    super({
      code: 'VALIDATION_ERROR',
      message,
      messageBn,
      field,
      details,
      correlationId,
      statusCode: 400,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', messageBn = 'প্রমাণীকরণ ব্যর্থ হয়েছে', correlationId?: string) {
    super({
      code: 'AUTHENTICATION_ERROR',
      message,
      messageBn,
      correlationId,
      statusCode: 401,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized', messageBn = 'এই কাজটি করার অনুমতি আপনার নেই', correlationId?: string) {
    super({
      code: 'AUTHORIZATION_ERROR',
      message,
      messageBn,
      correlationId,
      statusCode: 403,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string, correlationId?: string) {
    super({
      code: 'NOT_FOUND',
      message: `${entity} not found${id ? `: ${id}` : ''}`,
      messageBn: `${entity} খুঁজে পাওয়া যায়নি`,
      correlationId,
      statusCode: 404,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, messageBn: string, correlationId?: string) {
    super({
      code: 'CONFLICT',
      message,
      messageBn,
      correlationId,
      statusCode: 409,
    });
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, messageBn: string, correlationId?: string, details?: unknown) {
    super({
      code: 'BUSINESS_RULE_ERROR',
      message,
      messageBn,
      correlationId,
      details,
      statusCode: 422,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, messageBn: string, correlationId?: string, details?: unknown) {
    super({
      code: 'DATABASE_ERROR',
      message,
      messageBn,
      correlationId,
      details,
      statusCode: 500,
    });
  }
}

export class InsufficientStockError extends AppError {
  constructor(currentStock: string, requested: string, correlationId?: string) {
    super({
      code: 'INSUFFICIENT_STOCK',
      message: `Insufficient stock. Current: ${currentStock}, Requested: ${requested}`,
      messageBn: `স্টকে পর্যাপ্ত পণ্য নেই। বর্তমান স্টক: ${currentStock}`,
      correlationId,
      details: { currentStock, requested },
      statusCode: 422,
    });
  }
}

export class InvalidIpcChannelError extends AppError {
  constructor(channel: string, correlationId?: string) {
    super({
      code: 'INVALID_IPC_CHANNEL',
      message: `Invalid IPC channel: ${channel}`,
      messageBn: `অননুমোদিত সিস্টেম অনুরোধ`,
      correlationId,
      statusCode: 403,
    });
  }
}

export class InvalidIpcPayloadError extends AppError {
  constructor(message: string, messageBn: string, correlationId?: string, details?: unknown) {
    super({
      code: 'INVALID_IPC_PAYLOAD',
      message,
      messageBn,
      correlationId,
      details,
      statusCode: 400,
    });
  }
}
