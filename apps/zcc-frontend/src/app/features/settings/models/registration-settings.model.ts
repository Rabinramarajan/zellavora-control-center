/** Mirrors the backend contract in modules/registration-settings/registration-settings.dto.ts. */

/** Types an organization can open itself to. Only member joins, for now. */
export const ORGANIZATION_REGISTRATION_TYPES = ['ORGANIZATION_MEMBER'] as const;
export type OrganizationRegistrationType = (typeof ORGANIZATION_REGISTRATION_TYPES)[number];

export const REGISTRATION_TYPE_LABELS: Record<OrganizationRegistrationType, string> = {
  ORGANIZATION_MEMBER: 'People joining this organization',
};

export interface RegistrationSettingsPayload {
  allowSelfRegistration: boolean;
  allowedRegistrationTypes: OrganizationRegistrationType[];
  requireAdminApproval: boolean;
  requireEmailVerification: boolean;
}

export interface RegistrationSettings extends RegistrationSettingsPayload {
  /** False when the deployment-wide flag is off, which overrides everything here. */
  globallyEnabled: boolean;
  globallyAvailableTypes: readonly string[];
  /** Whether this organization is currently reachable from the sign-up page. */
  effectivelyOpen: boolean;
}

export const DEFAULT_REGISTRATION_SETTINGS: RegistrationSettings = {
  allowSelfRegistration: false,
  allowedRegistrationTypes: ['ORGANIZATION_MEMBER'],
  requireAdminApproval: true,
  requireEmailVerification: true,
  globallyEnabled: false,
  globallyAvailableTypes: [],
  effectivelyOpen: false,
};
