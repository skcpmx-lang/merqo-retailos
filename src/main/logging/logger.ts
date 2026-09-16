/**
 * Structured logging for MERQO RetailOS
 * Uses console for dev, file for production (electron-log style but simple)
 * No sensitive data in logs
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  action?: string;
  durationMs?: number;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel = (process.env.NODE_ENV === 'production' ? 'info' : 'debug') as LogLevel;
  private logFilePath?: string;

  setLogFilePath(path: string) {
    this.logFilePath = path;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return order[level] >= order[this.level];
  }

  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctxStr = context ? ` ${JSON.stringify(this.sanitize(context))}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${ctxStr}`;
  }

  private sanitize(context: LogContext): LogContext {
    // Remove sensitive fields
    const sensitive = ['password', 'password_hash', 'pin', 'pin_hash', 'card', 'card_last4', 'account_number'];
    const sanitized: LogContext = {};
    for (const [k, v] of Object.entries(context)) {
      if (sensitive.some(s => k.toLowerCase().includes(s))) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  debug(message: string, context?: LogContext) {
    if (!this.shouldLog('debug')) return;
    console.debug(this.format('debug', message, context));
  }

  info(message: string, context?: LogContext) {
    if (!this.shouldLog('info')) return;
    console.info(this.format('info', message, context));
  }

  warn(message: string, context?: LogContext) {
    if (!this.shouldLog('warn')) return;
    console.warn(this.format('warn', message, context));
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (!this.shouldLog('error')) return;
    const errStr = error instanceof Error ? `${error.message}\n${error.stack}` : String(error ?? '');
    console.error(this.format('error', `${message}${errStr ? ` - ${errStr}` : ''}`, context));
  }

  // For IPC logging with correlation
  ipcRequest(channel: string, correlationId: string, userId?: string) {
    this.debug(`IPC request: ${channel}`, { correlationId, userId, action: channel });
  }

  ipcResponse(channel: string, correlationId: string, durationMs: number, success: boolean) {
    this.debug(`IPC response: ${channel}`, { correlationId, durationMs, success, action: channel });
  }
}

export const logger = new Logger();
