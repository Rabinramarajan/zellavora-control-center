/**
 * @Audited — decorator that writes an audit entry after a service method
 * succeeds. Intended for mutating methods whose arguments are (id, dto).
 *
 * Usage:
 *   @Audited({ action: 'role.permissions.replaced', resource: 'role' })
 *   async replacePermissions(roleId: string, dto: SetPermissionsDto) { ... }
 *
 * The decorator calls the method, then writes an audit row using the resolved
 * actor/tenant/request metadata from the request context. `before`/`after`
 * can be provided via callbacks that receive the method arguments (for diffing).
 */
import { AuditService, type AuditSeverity } from '../audit';
import { getRequestContext } from '../request-context';

export interface AuditedOptions {
  action: string;
  resource: string;
  severity?: AuditSeverity;
  /** Derive the resourceId from the method args. Defaults to first string arg. */
  resourceId?: (...args: unknown[]) => string | null | undefined;
  /** Derive the before/after snapshot for the diff from method args + result. */
  before?: (...args: unknown[]) => Record<string, unknown> | null | undefined;
  after?: (...args: unknown[]) => Record<string, unknown> | null | undefined;
  metadata?: (...args: unknown[]) => Record<string, unknown> | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => Promise<unknown>;

const firstStringId = (...args: unknown[]): string | null => {
  for (const arg of args) {
    if (typeof arg === 'string') return arg;
  }
  return null;
};

export function Audited(options: AuditedOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_target: unknown, _key: string, descriptor: PropertyDescriptor): void => {
    const original = descriptor.value as AnyFn;
    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const result = await original.apply(this, args);
      const ctx = getRequestContext();
      const resourceId = options.resourceId ? options.resourceId(...args) : firstStringId(...args);
      void AuditService.log({
        action: options.action,
        resource: options.resource,
        severity: options.severity ?? 'info',
        resourceId: resourceId ?? undefined,
        before: options.before ? options.before(...args) ?? null : null,
        after: options.after ? options.after(...args) ?? null : null,
        metadata: options.metadata ? options.metadata(...args) : undefined,
        ...(ctx.actorId ? { actorId: ctx.actorId } : {}),
        ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
        ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
        ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      return result;
    };
  };
}
