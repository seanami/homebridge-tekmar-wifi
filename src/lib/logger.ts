/**
 * Logger for Watts Home API
 * Logs to file and optionally to console
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const LOG_FILE = path.join(process.cwd(), 'watts-cli.log');

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private async writeLog(level: string, message: string, data?: unknown): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}`;
    const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';

    // Write to file
    try {
      await fs.appendFile(LOG_FILE, logLine + dataStr + '\n', 'utf-8');
    } catch (error) {
      // Ignore file write errors - we don't want logging to break the app
      console.error(`Failed to write to log file: ${error}`);
    }

    // Also write to console for ERROR and WARN
    if (level === 'ERROR' || level === 'WARN') {
      console.error(logLine);
      if (data) {
        console.error(dataStr);
      }
    }
  }

  async debug(message: string, data?: unknown): Promise<void> {
    if (this.level <= LogLevel.DEBUG) {
      await this.writeLog('DEBUG', message, data);
    }
  }

  async info(message: string, data?: unknown): Promise<void> {
    if (this.level <= LogLevel.INFO) {
      await this.writeLog('INFO', message, data);
    }
  }

  async warn(message: string, data?: unknown): Promise<void> {
    if (this.level <= LogLevel.WARN) {
      await this.writeLog('WARN', message, data);
    }
  }

  async error(message: string, error?: unknown): Promise<void> {
    if (this.level <= LogLevel.ERROR) {
      const errorData = error ? {
        message: (error && typeof error === 'object' && 'message' in error) ? String(error.message) : String(error),
        stack: (error && typeof error === 'object' && 'stack' in error) ? String(error.stack) : undefined,
        response: (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object') ? {
          status: ('status' in error.response) ? error.response.status : undefined,
          statusText: ('statusText' in error.response) ? error.response.statusText : undefined,
          headers: ('headers' in error.response) ? error.response.headers : undefined,
          data: ('data' in error.response) ? error.response.data : undefined,
        } : undefined,
      } : undefined;
      await this.writeLog('ERROR', message, errorData);
    }
  }

  // Convenience method for HTTP requests
  async logRequest(method: string, url: string, headers?: unknown, body?: unknown): Promise<void> {
    await this.debug(`HTTP ${method} ${url}`, {
      headers: this.sanitizeHeaders(headers),
      body: body,
    });
  }

  // Convenience method for HTTP responses
  async logResponse(status: number, statusText: string, headers?: unknown, body?: unknown): Promise<void> {
    await this.debug(`HTTP Response ${status} ${statusText}`, {
      headers: this.sanitizeHeaders(headers),
      body: body,
    });
  }

  // Sanitize headers to remove sensitive data
  public sanitizeHeaders(headers: unknown): Record<string, unknown> {
    if (!headers || typeof headers !== 'object') {
      return {};
    }
    const sanitized = { ...headers as Record<string, unknown> };
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer [REDACTED]';
    }
    if (sanitized['x-csrf-token']) {
      sanitized['x-csrf-token'] = '[REDACTED]';
    }
    if (sanitized.Cookie) {
      sanitized.Cookie = '[REDACTED]';
    }
    return sanitized;
  }
}

// Default logger instance
export const logger = new Logger(
  process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
);
