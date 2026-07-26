import { Injectable } from '@angular/core';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private currentLogLevel = this.getEnvironmentLogLevel();

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.currentLogLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    if (typeof console !== 'undefined') {
      const consoleMethod = this.getConsoleMethod(level);
      const prefix = `[${levelName}] [${timestamp}]`;

      if (data) {
        consoleMethod(`${prefix} ${message}`, data);
      } else {
        consoleMethod(`${prefix} ${message}`);
      }
    }
  }

  private getConsoleMethod(
    level: LogLevel
  ): (...args: unknown[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.log;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
    }
  }

  private getEnvironmentLogLevel(): LogLevel {
    if (typeof import.meta === 'undefined') {
      return LogLevel.INFO;
    }

    const logLevel = (import.meta as any).env?.LOG_LEVEL;

    switch (logLevel?.toUpperCase()) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }
}
