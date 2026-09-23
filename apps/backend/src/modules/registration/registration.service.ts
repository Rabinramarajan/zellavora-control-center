/**
 * Registration Service
 * Helper functions for the registration flow
 */

import { prisma } from '../../infrastructure/prisma';

const PASSWORD_MIN_LENGTH = 12;

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
// ORGANIZATION NAME CHECK
// =============================================================================

export async function checkOrganizationNameAvailability(name: string): Promise<{
  available: boolean;
  message?: string;
  suggestion?: string;
}> {
  const normalizedName = name.trim().replace(/\s+/g, ' ');

  if (normalizedName.length < 3) {
    return {
      available: false,
      message: 'Organization name must be at least 3 characters',
    };
  }

  if (normalizedName.length > 100) {
    return {
      available: false,
      message: 'Organization name cannot exceed 100 characters',
    };
  }

  const existingOrg = await prisma.organization.findFirst({
    where: {
      name: { equals: normalizedName, mode: 'insensitive' },
      isDeleted: false,
    },
    select: { id: true, name: true },
  });

  if (existingOrg) {
    return {
      available: false,
      message: `The organization name "${existingOrg.name}" is already taken`,
      suggestion: `${normalizedName} ${new Date().getFullYear()}`,
    };
  }

  return {
    available: true,
    message: 'Organization name is available',
  };
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
