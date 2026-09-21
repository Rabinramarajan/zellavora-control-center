import type { RequestHandler } from 'express';

/** Preserve the legacy message envelope for object responses. */
export const responseEnvelope: RequestHandler = (_req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if (!body.msg) {
        const errorMsgs: any[] = [];
        if (body.error && body.error.message) {
          errorMsgs.push(body.error.message);
        }
        body.msg = {
          errorMessage: errorMsgs,
          infoMessage: {
            id: 0,
            msg: '',
            msgType: 'Information',
          },
        };
      }
    }
    return originalJson.call(this, body);
  };
  next();
};
