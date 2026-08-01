/**
 * Request context — AsyncLocalStorage carrier for the current HTTP request's
 * metadata (actor, tenant, ip, user-agent, request-id). Set by the
 * `requestContext` middleware; consumed by the audit service and `@Audited`
 * so decorators don't need to thread req through every service method.
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  actorId?: string | null;
  organizationId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return requestContextStorage.getStore() ?? {};
}

/** Run `fn` with a populated request context (called by the middleware). */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}
