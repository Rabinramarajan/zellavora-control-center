import { Request, Response, NextFunction } from 'express';
import { config } from '@/config/env';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export class AppError extends Error implements ApiError {
  constructor(
    message: string,
    public status: number = 500,
    public code: string = 'INTERNAL_SERVER_ERROR'
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
  console.error(error);

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        message: error.message,
        code: error.code,
        status: error.status,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      message:
        config.nodeEnv === 'production'
          ? 'Internal server error'
          : error.message,
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
    },
  });
};
