import type { Response, NextFunction } from 'express';
import {
  authenticate as baseAuthenticate,
  type AuthRequest,
} from '../../../middleware/auth';

export type { AuthRequest };

/**
 * Application Authentication Guard.
 * Authenticates user access tokens and populates request user context.
 */
export const appAuthGuard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  await baseAuthenticate(req, res, next);
};
