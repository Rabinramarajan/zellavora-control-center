/**
 * Validation and wire types for an organization's self-registration settings.
 *
 * These sit on top of the deployment-wide ALLOW_SELF_REGISTRATION flag: both
 * have to be on before anyone can register into an organization. The global
 * flag says the feature exists; these say this organization wants it.
 */
import { z } from 'zod';

/** Types an organization can open itself to. Mirrors the backend's narrowed enum. */
export const ORGANIZATION_REGISTRATION_TYPES = ['ORGANIZATION_MEMBER'] as const;
export type OrganizationRegistrationType = (typeof ORGANIZATION_REGISTRATION_TYPES)[number];

export const RegistrationSettingsSchema = z.object({
  allowSelfRegistration: z.boolean(),
  /**
   * Empty means "nothing", not "the default" — an explicit empty list closes
   * the organization while leaving the switch on, which is a state an
   * administrator can reach from the UI and must be honoured.
   */
  allowedRegistrationTypes: z.array(z.enum(ORGANIZATION_REGISTRATION_TYPES)),
  requireAdminApproval: z.boolean(),
  requireEmailVerification: z.boolean(),
});

export type RegistrationSettingsDto = z.infer<typeof RegistrationSettingsSchema>;

export interface RegistrationSettingsView extends RegistrationSettingsDto {
  /** False when ALLOW_SELF_REGISTRATION is off, which overrides everything here. */
  globallyEnabled: boolean;
  /** Types the deployment offers at all, for narrowing the UI's choices. */
  globallyAvailableTypes: readonly string[];
  /** Whether this organization is currently reachable from the sign-up page. */
  effectivelyOpen: boolean;
}
