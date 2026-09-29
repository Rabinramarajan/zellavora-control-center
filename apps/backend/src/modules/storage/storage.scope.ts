import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';

export interface StorageScope {
  prefix: string;
  token?: string;
}

/** Credentials stay in server environment variables, never in company content. */
export async function storageScope(tenantId: string): Promise<StorageScope> {
  if (!tenantId || !/^[\da-f-]{36}$/i.test(tenantId)) {
    throw new AppError('Tenant context is required', 401, 'TENANT_REQUIRED');
  }
  const setting = await prisma.commonConfiguration.findUnique({
    where: { organizationId_key: { organizationId: tenantId, key: 'storage.blob' } },
  });
  const prefix = `tenants/${tenantId}/`;
  if (!setting) {
    // Keep the original company's pre-tenant library available. Reserved tenant
    // folders are excluded even when both companies use the same physical store.
    const organization = await prisma.organization.findUnique({
      where: { id: tenantId },
      select: { clientCode: true },
    });
    return { prefix: organization?.clientCode === 'zellavora-inc' ? '' : prefix };
  }

  const token = process.env[`BLOB_READ_WRITE_TOKEN_${tenantId.replace(/-/g, '_').toUpperCase()}`];
  if (!token) {
    throw new AppError(
      'This company’s media store is not connected on this server',
      503,
      'TENANT_STORAGE_NOT_CONFIGURED'
    );
  }
  return { prefix, token };
}

export function scopedPath(scope: StorageScope, pathname: string): string {
  if (
    !pathname.startsWith(scope.prefix) ||
    (!scope.prefix && pathname.startsWith('tenants/')) ||
    /[\\?#%:]/.test(pathname) ||
    pathname.startsWith('/') ||
    pathname.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new AppError('Media file is outside this company', 403, 'MEDIA_TENANT_MISMATCH');
  }
  return pathname;
}
