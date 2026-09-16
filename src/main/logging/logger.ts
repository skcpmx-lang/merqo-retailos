/**
 * Structured logging for MERQO RetailOS — Windows Production
 * Uses console for dev, file for production with rotation
 * No sensitive data in logs
 */

import fs from 'fs';
import path from 'path';

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
  private maxFileSize = 5 * 1024 * 1024;
  private maxFiles = 5;

  setLogFilePath(logDir: string) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      const date = new Date().toISOString().slice(0, 10);
      this.logFilePath = path.join(logDir, `merqo-${date}.log`);
    } catch (e) {
      console.error('Failed to set log file path', e);
    }
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
    const sensitive = ['password', 'password_hash', 'pin', 'pin_hash', 'card', 'card_last4', 'account_number', 'token', 'secret', 'api_key', 'mfs_account'];
    const sanitized: LogContext = {};
    for (const [k, v] of Object.entries(context)) {
      if (sensitive.some(s => k.toLowerCase().includes(s))) {
        sanitized[k] = '[REDACTED]';
      } else {
        if (typeof v === 'string' && /^\d{10,}$/.test(v) && k.toLowerCase().includes('account')) {
          sanitized[k] = '[REDACTED]';
        } else {
          sanitized[k] = v;
        }
      }
    }
    return sanitized;
  }

  private writeToFile(line: string) {
    if (!this.logFilePath) return;
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stat = fs.statSync(this.logFilePath);
        if (stat.size > this.maxFileSize) {
          for (let i = this.maxFiles - 1; i >= 1; i--) {
            const oldPath = `${this.logFilePath}.${i}`;
            const newPath = `${this.logFilePath}.${i + 1}`;
            if (fs.existsSync(oldPath)) {
              if (i === this.maxFiles - 1) {
                fs.unlinkSync(oldPath);
              } else {
                fs.renameSync(oldPath, newPath);
              }
            }
          }
          fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
        }
      }
      fs.appendFileSync(this.logFilePath, line + '\n', 'utf-8');
    } catch (e) {
      console.error('Failed to write log file', e);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;
    const formatted = this.format(level, message, context);
    if (level === 'debug') console.debug(formatted);
    else if (level === 'info') console.info(formatted);
    else if (level === 'warn') console.warn(formatted);
    else console.error(formatted);
    this.writeToFile(formatted);
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (!this.shouldLog('error')) return;
    const errStr = error instanceof Error ? `${error.message}` : String(error ?? '');
    const sanitizedStack = error instanceof Error && error.stack ? error.stack.replace(/\/home\/.*?\//g, '[PATH]/') : '';
    const fullMessage = `${message}${errStr ? ` - ${errStr}` : ''}`;
    this.log('error', fullMessage, context);
    if (sanitizedStack && this.logFilePath) {
      this.writeToFile(`[${new Date().toISOString()}] [STACK] ${sanitizedStack}`);
    }
  }

  ipcRequest(channel: string, correlationId: string, userId?: string) {
    this.debug(`IPC request: ${channel}`, { correlationId, userId, action: channel });
  }

  ipcResponse(channel: string, correlationId: string, durationMs: number, success: boolean) {
    this.debug(`IPC response: ${channel}`, { correlationId, durationMs, success, action: channel });
  }
}

export const logger = new Logger();
