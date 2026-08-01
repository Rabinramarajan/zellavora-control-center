import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error implements ApiError {
  constructor(
    message: string,
    public status: number = 500,
    public code: string = 'INTERNAL_SERVER_ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  error: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(`[error] ${req.method} ${req.originalUrl}`, error);

  // If the response has already begun streaming, writing another one throws
  // ERR_HTTP_HEADERS_SENT and takes down the process. Hand off to Express's
  // built-in handler, which aborts the connection cleanly.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        message: error.message,
        code: error.code,
        status: error.status,
        ...(error.details ?? {}),
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      message: config.nodeEnv === 'production' ? 'Internal server error' : error.message,
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
    },
  });
};
