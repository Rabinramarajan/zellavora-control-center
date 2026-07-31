/**
 * Registration Service
 * Helper functions for the registration flow
 */

import crypto from 'crypto';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import { PasswordService } from '../../services/auth/password.service';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_HISTORY_LIMIT = 5;

// =============================================================================
// EMAIL CHECK
// =============================================================================

export async function checkEmailAvailability(email: string): Promise<{
  available: boolean;
  message?: string;
  suggestion?: string;
}> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email exists in users
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (existingUser) {
    // Generate suggestion
    const [localPart] = normalizedEmail.split('@');
    const suggestions = [
      `${localPart}+work@${normalizedEmail.split('@')[1]}`,
      `${localPart}.${new Date().getFullYear()}@${normalizedEmail.split('@')[1]}`,
    ];

    return {
      available: false,
      message: 'This email is already registered',
      suggestion: suggestions[0],
    };
  }

  return {
    available: true,
    message: 'Email is available',
  };
}

// =============================================================================
// ORGANIZATION CODE CHECK
// =============================================================================

export async function checkOrganizationCodeAvailability(code: string): Promise<{
  available: boolean;
  message?: string;
  suggestion?: string;
}> {
  const normalizedCode = code
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  if (normalizedCode.length < 2) {
    return {
      available: false,
      message: 'Organization code must be at least 2 characters',
    };
  }

  if (normalizedCode.length > 16) {
    return {
      available: false,
      message: 'Organization code cannot exceed 16 characters',
    };
  }

  // Reserved codes
  const reservedCodes = [
    'admin',
    'api',
    'app',
    'auth',
    'blog',
    'cdn',
    'dashboard',
    'dev',
    'docs',
    'email',
    'ftp',
    'github',
    'help',
    'host',
    'login',
    'mail',
    'mobile',
    'new',
    'oauth',
    'old',
    'panel',
    'password',
    'portal',
    'public',
    'secure',
    'security',
    'server',
    'shop',
    'site',
    'smtp',
    'ssh',
    'stage',
    'static',
    'status',
    'store',
    'support',
    'test',
    'testing',
    'tmp',
    'update',
    'upload',
    'vpn',
    'web',
    'webmail',
    'websocket',
    'www',
    'zellavora',
    'zcc',
    'admin',
    'root',
    'system',
    'superadmin',
    'owner',
  ];

  if (reservedCodes.includes(normalizedCode)) {
    return {
      available: false,
      message: 'This organization code is reserved',
      suggestion: `${normalizedCode}-org`,
    };
  }

  // Check if code exists
  const existingOrg = await prisma.organization.findFirst({
    where: {
      clientCode: normalizedCode,
      isDeleted: false,
    },
    select: { id: true, name: true },
  });

  if (existingOrg) {
    // Generate suggestion
    const suggestion = `${normalizedCode}${Math.floor(Math.random() * 1000)}`;
    return {
      available: false,
      message: `The code "${normalizedCode}" is already taken by "${existingOrg.name}"`,
      suggestion,
    };
  }

  return {
    available: true,
    message: 'Organization code is available',
  };
}

// =============================================================================
// GENERATE ORGANIZATION CODE
// =============================================================================

export async function generateOrganizationCode(name: string): Promise<string> {
  // Generate a code from the organization name
  let baseCode = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.substring(0, 4))
    .join('');

  // Ensure minimum length
  if (baseCode.length < 3) {
    baseCode = baseCode.padEnd(3, '0');
  }

  // Ensure it's unique
  let code = baseCode.substring(0, 12);
  let attempts = 0;

  while (attempts < 100) {
    const check = await checkOrganizationCodeAvailability(code);
    if (check.available) {
      return code;
    }
    code = `${baseCode}${Math.floor(Math.random() * 100)}`.substring(0, 12);
    attempts++;
  }

  // Fallback to random code
  return `${baseCode.substring(0, 8)}${crypto.randomInt(1000, 9999)}`;
}

// =============================================================================
// PASSWORD VALIDATION
// =============================================================================

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-4 (weak to excellent)
  errors: string[];
  suggestions: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
}

export async function validatePasswordStrength(
  password: string
): Promise<PasswordValidationResult> {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    suggestions.push(`Add ${PASSWORD_MIN_LENGTH - password.length} more characters`);
  } else {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
    suggestions.push('Add an uppercase letter (A-Z)');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
    suggestions.push('Add a lowercase letter (a-z)');
  } else {
    score += 1;
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
    suggestions.push('Add a number (0-9)');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
    suggestions.push('Add a special character (!@#$%^&*)');
  } else {
    score += 1;
  }

  // Additional checks for strong passwords
  if (password.length >= 16) score += 1;
  if (/\d{3,}/.test(password)) score += 1; // Multiple consecutive numbers
  if (/[a-zA-Z]{5,}/.test(password)) score += 1; // Multiple consecutive letters
  if (/(.)\1{2,}/.test(password)) {
    // Has repeated characters - reduce score
    score = Math.max(0, score - 1);
    errors.push('Avoid repeated characters');
  }

  // Common patterns to avoid
  const commonPatterns = [
    /password/i,
    /123456/,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i,
    /monkey/i,
    /dragon/i,
    /master/i,
    /login/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Avoid common passwords or patterns');
      suggestions.push('Choose a unique password');
      score = Math.max(0, score - 2);
      break;
    }
  }

  // Determine strength label
  let strength: PasswordValidationResult['strength'];
  if (score < 3) {
    strength = 'weak';
  } else if (score < 4) {
    strength = 'fair';
  } else if (score < 6) {
    strength = 'good';
  } else if (score < 8) {
    strength = 'strong';
  } else {
    strength = 'excellent';
  }

  return {
    isValid: errors.length === 0,
    score: Math.min(score, 10),
    errors,
    suggestions: suggestions.slice(0, 3),
    strength,
  };
}

// =============================================================================
// PASSWORD HISTORY CHECK
// =============================================================================

export async function checkPasswordHistory(
  userId: string,
  newPassword: string
): Promise<{ valid: boolean; message?: string }> {
  // Get recent passwords
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: PASSWORD_HISTORY_LIMIT,
    select: { passwordHash: true },
  });

  if (history.length === 0) {
    return { valid: true };
  }

  // Check against history
  for (const record of history) {
    const isMatch = await PasswordService.verify(newPassword, record.passwordHash);
    if (isMatch) {
      return {
        valid: false,
        message: 'This password has been used recently. Please choose a different password.',
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// INVITATION PROCESSING
// =============================================================================

export async function processInvitation(code: string): Promise<{
  valid: boolean;
  invitation?: any;
  error?: string;
}> {
  const invitation = await prisma.invitation.findFirst({
    where: {
      code,
      status: 'pending',
      used: false,
      expiresAt: { gte: new Date() },
    },
    include: {
      organization: true,
    },
  });

  if (!invitation) {
    return {
      valid: false,
      error: 'Invalid or expired invitation code',
    };
  }

  // Check if email already registered
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
  });

  if (existingUser) {
    return {
      valid: false,
      error: 'This email is already registered. Please login instead.',
    };
  }

  return {
    valid: true,
    invitation,
  };
}

// =============================================================================
// REGISTRATION SESSION MANAGEMENT
// =============================================================================

export async function getRegistrationSession(sessionId: string) {
  const session = await prisma.registrationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Registration session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (new Date() > session.expiresAt) {
    throw new AppError('Registration session has expired', 400, 'SESSION_EXPIRED');
  }

  return session;
}

export async function updateRegistrationSession(
  sessionId: string,
  data: Partial<{
    emailVerified: boolean;
    mobileVerified: boolean;
    organizationName: string;
    organizationCode: string;
    industry: string;
    size: string;
    branchName: string;
    branchCode: string;
    mfaEnabled: boolean;
    mfaMethod: string;
    mfaSecret: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    currentStep: number;
    status: string;
  }>
) {
  return prisma.registrationSession.update({
    where: { id: sessionId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

// =============================================================================
// ORGANIZATION CREATION
// =============================================================================

export async function createOrganizationWithOwner(data: {
  // Organization
  organizationName: string;
  organizationCode: string;
  industry?: string;
  size?: string;
  website?: string;
  gstNumber?: string;
  taxNumber?: string;
  logoUrl?: string;
  useCases?: string[];

  // Branch
  branchName: string;
  branchCode?: string;
  branchAddress?: string;
  branchCity?: string;
  branchState?: string;
  branchCountry?: string;
  branchPincode?: string;

  // User
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  mobile?: string;
  mobileVerified?: boolean;
  passwordHash: string;

  // MFA
  mfaEnabled: boolean;
  mfaMethod?: string;
  mfaSecret?: string;

  // Terms
  termsAccepted: boolean;
  privacyAccepted: boolean;
  cookieAccepted?: boolean;
  marketingConsent?: boolean;

  // Location
  country: string;
  timezone?: string;
  language?: string;
  gender?: string;

  // Invite
  inviteCode?: string;

  // Metadata
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Get owner role
    const ownerRole = await tx.role.findFirst({
      where: { key: 'owner' },
    });

    if (!ownerRole) {
      throw new AppError('System configuration error: Owner role not found', 500);
    }

    // Create Organization
    const organization = await tx.organization.create({
      data: {
        name: data.organizationName,
        clientCode: data.organizationCode.toLowerCase(),
        industry: data.industry,
        size: data.size,
        website: data.website,
        gstNumber: data.gstNumber,
        taxNumber: data.taxNumber,
        logoUrl: data.logoUrl,
        useCases: data.useCases || [],
        email: data.email,
        country: data.country,
        termsAccepted: data.termsAccepted,
        termsAcceptedAt: data.termsAccepted ? new Date() : null,
        privacyAccepted: data.privacyAccepted,
        privacyAcceptedAt: data.privacyAccepted ? new Date() : null,
        cookieAccepted: data.cookieAccepted || false,
        cookieAcceptedAt: data.cookieAccepted ? new Date() : null,
        marketingConsent: data.marketingConsent || false,
        marketingConsentAt: data.marketingConsent ? new Date() : null,
        registrationSource: data.inviteCode ? 'invite' : 'organic',
        inviteCode: data.inviteCode,
        status: 'active',
      },
    });

    // Create Branch
    const branch = await tx.branch.create({
      data: {
        organizationId: organization.id,
        name: data.branchName,
        code: data.branchCode || 'HQ',
        isHeadOffice: true,
        address: data.branchAddress,
        city: data.branchCity,
        state: data.branchState,
        country: data.branchCountry || data.country,
        pincode: data.branchPincode,
        status: 'active',
      },
    });

    // Create User
    const user = await tx.user.create({
      data: {
        email: data.email.toLowerCase(),
        emailId: data.email.toLowerCase(),
        fullName: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        mobile: data.mobile,
        mobileVerified: data.mobileVerified || false,
        country: data.country,
        timezone: data.timezone,
        language: data.language || 'en',
        gender: data.gender,
        passwordHash: data.passwordHash,
        role: 'owner',
        tenantId: organization.id,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        mfaEnabled: data.mfaEnabled,
        mfaMethod: data.mfaMethod,
        mfaSecret: data.mfaSecret,
        termsAccepted: data.termsAccepted,
        termsAcceptedAt: data.termsAccepted ? new Date() : null,
        privacyAccepted: data.privacyAccepted,
        privacyAcceptedAt: data.privacyAccepted ? new Date() : null,
        securityAlerts: true,
        marketingEmails: data.marketingConsent || false,
        statusValue: 'active',
        statusDescription: 'Active',
      },
    });

    // Create Membership
    await tx.userTenant.create({
      data: {
        userId: user.id,
        tenantId: organization.id,
        role: 'owner',
        isDefault: true,
        joinedAt: new Date(),
      },
    });

    // Create Role Assignment
    await tx.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: ownerRole.id,
        organizationId: organization.id,
      },
    });

    // Create Profile
    await tx.profile.create({
      data: {
        userId: user.id,
      },
    });

    // Create Default Workspace
    await tx.workspace.create({
      data: {
        organizationId: organization.id,
        name: 'Default Workspace',
        slug: 'default',
        description: 'Default workspace for your organization',
      },
    });

    // Create Default Settings
    await tx.organizationSettings.createMany({
      data: [
        {
          organizationId: organization.id,
          key: 'default_language',
          value: data.language || 'en',
          category: 'general',
        },
        {
          organizationId: organization.id,
          key: 'default_timezone',
          value: data.timezone || 'UTC',
          category: 'general',
        },
        {
          organizationId: organization.id,
          key: 'session_timeout',
          value: '3600',
          category: 'security',
        },
        {
          organizationId: organization.id,
          key: 'mfa_required',
          value: data.mfaEnabled ? 'true' : 'false',
          category: 'security',
        },
      ],
    });

    // Create Audit Log
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'organization_created',
        resource: 'organization',
        resourceId: organization.id,
        organizationId: organization.id,
        severity: 'info',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: {
          organizationName: data.organizationName,
          organizationCode: data.organizationCode,
          registrationSource: data.inviteCode ? 'invite' : 'organic',
        },
      },
    });

    // Store password in history
    await tx.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash: data.passwordHash,
      },
    });

    // Mark invitation as used if exists
    if (data.inviteCode) {
      await tx.invitation.updateMany({
        where: { code: data.inviteCode },
        data: {
          used: true,
          usedAt: new Date(),
          status: 'accepted',
        },
      });
    }

    return { organization, branch, user };
  });
}

// =============================================================================
// COUNTRY & TIMEZONE DATA
// =============================================================================

export const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', phoneCode: '+93' },
  { code: 'AL', name: 'Albania', phoneCode: '+355' },
  { code: 'DZ', name: 'Algeria', phoneCode: '+213' },
  { code: 'AR', name: 'Argentina', phoneCode: '+54' },
  { code: 'AU', name: 'Australia', phoneCode: '+61' },
  { code: 'AT', name: 'Austria', phoneCode: '+43' },
  { code: 'BD', name: 'Bangladesh', phoneCode: '+880' },
  { code: 'BE', name: 'Belgium', phoneCode: '+32' },
  { code: 'BR', name: 'Brazil', phoneCode: '+55' },
  { code: 'CA', name: 'Canada', phoneCode: '+1' },
  { code: 'CN', name: 'China', phoneCode: '+86' },
  { code: 'CO', name: 'Colombia', phoneCode: '+57' },
  { code: 'HR', name: 'Croatia', phoneCode: '+385' },
  { code: 'CZ', name: 'Czech Republic', phoneCode: '+420' },
  { code: 'DK', name: 'Denmark', phoneCode: '+45' },
  { code: 'EG', name: 'Egypt', phoneCode: '+20' },
  { code: 'FI', name: 'Finland', phoneCode: '+358' },
  { code: 'FR', name: 'France', phoneCode: '+33' },
  { code: 'DE', name: 'Germany', phoneCode: '+49' },
  { code: 'GR', name: 'Greece', phoneCode: '+30' },
  { code: 'HK', name: 'Hong Kong', phoneCode: '+852' },
  { code: 'HU', name: 'Hungary', phoneCode: '+36' },
  { code: 'IN', name: 'India', phoneCode: '+91' },
  { code: 'ID', name: 'Indonesia', phoneCode: '+62' },
  { code: 'IE', name: 'Ireland', phoneCode: '+353' },
  { code: 'IL', name: 'Israel', phoneCode: '+972' },
  { code: 'IT', name: 'Italy', phoneCode: '+39' },
  { code: 'JP', name: 'Japan', phoneCode: '+81' },
  { code: 'KE', name: 'Kenya', phoneCode: '+254' },
  { code: 'KR', name: 'South Korea', phoneCode: '+82' },
  { code: 'MY', name: 'Malaysia', phoneCode: '+60' },
  { code: 'MX', name: 'Mexico', phoneCode: '+52' },
  { code: 'NL', name: 'Netherlands', phoneCode: '+31' },
  { code: 'NZ', name: 'New Zealand', phoneCode: '+64' },
  { code: 'NG', name: 'Nigeria', phoneCode: '+234' },
  { code: 'NO', name: 'Norway', phoneCode: '+47' },
  { code: 'PK', name: 'Pakistan', phoneCode: '+92' },
  { code: 'PH', name: 'Philippines', phoneCode: '+63' },
  { code: 'PL', name: 'Poland', phoneCode: '+48' },
  { code: 'PT', name: 'Portugal', phoneCode: '+351' },
  { code: 'RO', name: 'Romania', phoneCode: '+40' },
  { code: 'RU', name: 'Russia', phoneCode: '+7' },
  { code: 'SA', name: 'Saudi Arabia', phoneCode: '+966' },
  { code: 'SG', name: 'Singapore', phoneCode: '+65' },
  { code: 'ZA', name: 'South Africa', phoneCode: '+27' },
  { code: 'ES', name: 'Spain', phoneCode: '+34' },
  { code: 'SE', name: 'Sweden', phoneCode: '+46' },
  { code: 'CH', name: 'Switzerland', phoneCode: '+41' },
  { code: 'TW', name: 'Taiwan', phoneCode: '+886' },
  { code: 'TH', name: 'Thailand', phoneCode: '+66' },
  { code: 'TR', name: 'Turkey', phoneCode: '+90' },
  { code: 'UA', name: 'Ukraine', phoneCode: '+380' },
  { code: 'AE', name: 'United Arab Emirates', phoneCode: '+971' },
  { code: 'GB', name: 'United Kingdom', phoneCode: '+44' },
  { code: 'US', name: 'United States', phoneCode: '+1' },
  { code: 'VN', name: 'Vietnam', phoneCode: '+84' },
];

export const INDUSTRIES = [
  { value: 'technology', label: 'Technology & Software' },
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'education', label: 'Education & Research' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing & Production' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'nonprofit', label: 'Non-Profit & NGO' },
  { value: 'real_estate', label: 'Real Estate & Construction' },
  { value: 'logistics', label: 'Logistics & Transportation' },
  { value: 'hospitality', label: 'Hospitality & Tourism' },
  { value: 'legal', label: 'Legal & Compliance' },
  { value: 'consulting', label: 'Consulting & Professional Services' },
  { value: 'other', label: 'Other' },
];

export const ORGANIZATION_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '10-50', label: '10-50 employees' },
  { value: '50-100', label: '50-100 employees' },
  { value: '100-500', label: '100-500 employees' },
  { value: '500+', label: '500+ employees' },
];

export const TIMEZONES = [
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time' },
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time' },
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brazil' },
  { value: 'Atlantic/Azores', label: '(UTC-01:00) Azores' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Paris' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) Berlin' },
  { value: 'Africa/Cairo', label: '(UTC+02:00) Cairo' },
  { value: 'Europe/Moscow', label: '(UTC+03:00) Moscow' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) India' },
  { value: 'Asia/Dhaka', label: '(UTC+06:00) Bangladesh' },
  { value: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) China' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) Auckland' },
];

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिंदी' },
];

export const USE_CASES = [
  { value: 'project_management', label: 'Project Management', icon: '📁' },
  { value: 'crm', label: 'Customer Relationship Management', icon: '👥' },
  { value: 'analytics', label: 'Analytics & Reporting', icon: '📊' },
  { value: 'hr_management', label: 'HR Management', icon: '👔' },
  { value: 'inventory', label: 'Inventory Management', icon: '📦' },
  { value: 'finance', label: 'Finance & Accounting', icon: '💰' },
  { value: 'marketing', label: 'Marketing Automation', icon: '📣' },
  { value: 'support', label: 'Customer Support', icon: '🎧' },
  { value: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { value: 'content', label: 'Content Management', icon: '📝' },
  { value: 'collaboration', label: 'Team Collaboration', icon: '🤝' },
  { value: 'other', label: 'Other', icon: '•••' },
];
