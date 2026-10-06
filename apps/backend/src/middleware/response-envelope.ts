import type { RequestHandler } from 'express';

/** Mirror of entMsgDetail in the frontend. */
export interface MsgDetail {
  msgID: number;
  msgType: number;
  msgDescription: string;
}

/** Mirror of entIEMessage in the frontend. */
export interface IEMessage {
  infoMessage: MsgDetail;
  errorMessage: any[];
  hasError: boolean;
}

function buildMsg(body: Record<string, any>): IEMessage {
  const errorMessages: any[] = [];

  if (body.error) {
    errorMessages.push(typeof body.error === 'string' ? body.error : (body.error.message ?? body.error));
  }

  const hasError = errorMessages.length > 0;

  return {
    infoMessage: {
      msgID: 0,
      msgType: 0,
      msgDescription: hasError ? '' : (body.message ?? ''),
    },
    errorMessage: errorMessages,
    hasError,
  };
}

/** Wraps every object response with the entIEMessage envelope under `msg`. */
export const responseEnvelope: RequestHandler = (_req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (body && typeof body === 'object' && !Array.isArray(body) && !body.msg) {
      body.msg = buildMsg(body);
    }
    return originalJson.call(this, body);
  };
  next();
};
