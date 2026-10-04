/**
 * Per-organization self-registration settings.
 *
 * Reads and writes the four `organizations` columns that gate self-registration,
 * and reports the effective state — an organization can have the switch on and
 * still be closed, because the deployment-wide flag overrides it.
 */
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { prisma } from '../../infrastructure/prisma';
import type {
  OrganizationRegistrationType,
  RegistrationSettingsDto,
  RegistrationSettingsView,
} from './registration-settings.dto';

const COLUMNS = {
  id: true,
  name: true,
  status: true,
  allowSelfRegistration: true,
  allowedRegistrationTypes: true,
  requireAdminApproval: true,
  requireEmailVerification: true,
} as const;

export class RegistrationSettingsService {
  async get(organizationId: string): Promise<RegistrationSettingsView> {
    const org = await prisma.organization.findFirst({
      where: { id: organizationId, isDeleted: false },
      select: COLUMNS,
    });
    if (!org) throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    return this.toView(org);
  }

  async update(
    organizationId: string,
    dto: RegistrationSettingsDto,
    actorId: string | null
  ): Promise<RegistrationSettingsView> {
    const before = await prisma.organization.findFirst({
      where: { id: organizationId, isDeleted: false },
      select: COLUMNS,
    });
    if (!before) throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');

    // Refuse a type the deployment does not offer rather than storing a value
    // that silently never takes effect.
    const unavailable = dto.allowedRegistrationTypes.filter(
      (t) => !config.registrationTypes.includes(t)
    );
    if (unavailable.length) {
      throw new AppError(
        `This deployment does not offer: ${unavailable.join(', ')}.`,
        400,
        'REGISTRATION_TYPE_UNAVAILABLE',
        { fields: { allowedRegistrationTypes: `Not available: ${unavailable.join(', ')}.` } }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        allowSelfRegistration: dto.allowSelfRegistration,
        allowedRegistrationTypes: dto.allowedRegistrationTypes,
        requireAdminApproval: dto.requireAdminApproval,
        requireEmailVerification: dto.requireEmailVerification,
        updatedBy: actorId,
      },
      select: COLUMNS,
    });

    // Opening an organization to public sign-up is a security-relevant change,
    // so it is audited with both sides of the switch.
    await AuditService.log({
      action: 'organization.registration_settings_updated',
      resource: 'organization',
      resourceId: organizationId,
      organizationId,
      actorId,
      severity: before.allowSelfRegistration === dto.allowSelfRegistration ? 'info' : 'warning',
      before: {
        allowSelfRegistration: before.allowSelfRegistration,
        allowedRegistrationTypes: before.allowedRegistrationTypes,
        requireAdminApproval: before.requireAdminApproval,
        requireEmailVerification: before.requireEmailVerification,
      },
      after: {
        allowSelfRegistration: updated.allowSelfRegistration,
        allowedRegistrationTypes: updated.allowedRegistrationTypes,
        requireAdminApproval: updated.requireAdminApproval,
        requireEmailVerification: updated.requireEmailVerification,
      },
    });

    return this.toView(updated);
  }

  private toView(org: {
    status: string;
    allowSelfRegistration: boolean;
    allowedRegistrationTypes: unknown;
    requireAdminApproval: boolean;
    requireEmailVerification: boolean;
  }): RegistrationSettingsView {
    const stored = org.allowedRegistrationTypes;
    // Null predates registration types and meant ORGANIZATION_MEMBER only.
    const types: OrganizationRegistrationType[] =
      stored === null || stored === undefined
        ? ['ORGANIZATION_MEMBER']
        : Array.isArray(stored)
          ? (stored as OrganizationRegistrationType[])
          : [];

    const globallyEnabled = config.selfRegistrationEnabled;
    return {
      allowSelfRegistration: org.allowSelfRegistration,
      allowedRegistrationTypes: types,
      requireAdminApproval: org.requireAdminApproval,
      requireEmailVerification: org.requireEmailVerification,
      globallyEnabled,
      globallyAvailableTypes: config.registrationTypes,
      effectivelyOpen:
        globallyEnabled &&
        org.allowSelfRegistration &&
        org.status === 'active' &&
        types.length > 0,
    };
  }
}
