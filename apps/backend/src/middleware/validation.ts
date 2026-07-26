import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from './error';

export type ValidationType = 'body' | 'query' | 'params';

export const validateRequest = (schema: ZodSchema, type: ValidationType = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = type === 'body' ? req.body : type === 'query' ? req.query : req.params;
      const parsed = schema.parse(data);

      if (type === 'body') req.body = parsed;
      else if (type === 'query') req.query = parsed;
      else req.params = parsed;

      next();
    } catch (error: any) {
      const message = error.errors?.[0]?.message || 'Validation failed';
      next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }
  };
};
