/**
 * Per-type copy, steps and terminal panels for self-registration. One table so
 * the chooser, the card header, the stepper and the success panel cannot drift
 * out of step with each other.
 */
import type { RegistrationType } from '../../../../shared/models/auth.model';

/** Icons drawn by the register template's inline SVG switch. */
export type RegistrationIcon = 'building' | 'user' | 'plus' | 'mail' | 'shield' | 'building-plus';

export interface RegistrationStep {
  readonly id: number;
  /** Shown in the stepper and used as the step's accessible group name. */
  readonly label: string;
}

export interface TerminalPanel {
  readonly icon: RegistrationIcon;
  readonly tone: 'violet' | 'cyan' | 'emerald';
  readonly kicker: string;
  readonly title: string;
  readonly titleAccent: string;
}

export interface RegistrationTypeMeta {
  readonly type: RegistrationType;
  /** Query-param value, e.g. /auth/register?type=individual. */
  readonly slug: string;
  readonly icon: RegistrationIcon;
  /** Accent class suffix: .rt-card--{accent}. */
  readonly accent: 'org' | 'solo' | 'create';
  /** Chooser card. */
  readonly cardTitle: string;
  readonly cardSubtitle: string;
  /** Form header, once the type is chosen. */
  readonly kicker: string;
  readonly title: string;
  readonly titleAccent: string;
  readonly lead: string;
  readonly steps: readonly RegistrationStep[];
  readonly terminal: TerminalPanel;
}

export const REGISTRATION_TYPES: readonly RegistrationTypeMeta[] = [
  {
    type: 'ORGANIZATION_MEMBER',
    slug: 'organization-member',
    icon: 'building',
    accent: 'org',
    cardTitle: 'Join an Organization',
    cardSubtitle: 'Your company already uses Zellavora',
    kicker: 'Get started',
    title: 'Create your',
    titleAccent: 'account',
    lead: "Join your organization's workspace on Zellavora Control Center.",
    steps: [
      { id: 1, label: 'Organization' },
      { id: 2, label: 'Security' },
    ],
    terminal: {
      icon: 'shield',
      tone: 'violet',
      kicker: 'Request received',
      title: 'Awaiting',
      titleAccent: 'approval',
    },
  },
  {
    type: 'INDIVIDUAL',
    slug: 'individual',
    icon: 'user',
    accent: 'solo',
    cardTitle: 'Individual',
    cardSubtitle: 'A personal, standalone account',
    kicker: 'Get started',
    title: 'Create your',
    titleAccent: 'account',
    lead: 'A personal account, ready in a minute. No organization needed.',
    steps: [
      { id: 1, label: 'Your details' },
      { id: 2, label: 'Security' },
    ],
    terminal: {
      icon: 'mail',
      tone: 'cyan',
      kicker: 'Almost there',
      title: 'Verify your',
      titleAccent: 'email',
    },
  },
  {
    type: 'CREATE_ORGANIZATION',
    slug: 'create-organization',
    icon: 'plus',
    accent: 'create',
    cardTitle: 'Create an Organization',
    cardSubtitle: 'Set up a new workspace',
    kicker: 'New workspace',
    title: 'Create your',
    titleAccent: 'organization',
    lead: "Set up a new workspace. You'll be its first administrator.",
    steps: [
      { id: 1, label: 'Organization' },
      { id: 2, label: 'Administrator' },
      { id: 3, label: 'Security' },
    ],
    terminal: {
      icon: 'building-plus',
      tone: 'emerald',
      kicker: 'Submitted',
      title: 'Organization',
      titleAccent: 'submitted',
    },
  },
];

export const metaFor = (type: RegistrationType): RegistrationTypeMeta =>
  REGISTRATION_TYPES.find((m) => m.type === type)!;

/** Resolves a `?type=` value, ignoring anything the server does not offer. */
export function typeFromSlug(
  slug: string | null | undefined,
  allowed: readonly RegistrationType[]
): RegistrationType | null {
  if (!slug) return null;
  const match = REGISTRATION_TYPES.find((m) => m.slug === slug.toLowerCase());
  return match && allowed.includes(match.type) ? match.type : null;
}

export const slugFor = (type: RegistrationType): string => metaFor(type).slug;
