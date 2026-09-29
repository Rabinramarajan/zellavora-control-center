import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Forwards a rejected handler promise to the error middleware. */
export const asyncHandler =
  <Req extends Request = Request>(
    fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown> | unknown
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
