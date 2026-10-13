import type { RequestHandler } from 'express';

/** One entry of the message envelope, as the frontend reads it. */
export interface MsgDetail {
  id: number;
  msg: string | null;
  msgType: 'Error' | 'Information';
}

/** Envelope attached under `msg` to every object response. */
export interface IEMessage {
  infoMessage: MsgDetail;
  errorMessage: MsgDetail[];
  hasError: boolean;
}

function buildMsg(body: Record<string, any>): IEMessage {
  const errorMessage: MsgDetail[] = [];

  if (body.error) {
    const text = typeof body.error === 'string' ? body.error : (body.error.message ?? body.error);
    errorMessage.push({ id: 0, msg: String(text), msgType: 'Error' });
  }

  const hasError = errorMessage.length > 0;

  return {
    infoMessage: {
      id: 0,
      msg: hasError ? null : (body.message ?? null),
      msgType: 'Information',
    },
    errorMessage,
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
