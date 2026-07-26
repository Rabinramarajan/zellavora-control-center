/**
 * Enterprise Licensing System Types & Interfaces
 */

// ========================================
// License Plans
// ========================================

export interface LicensePlan {
  id: string;
  key: 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';
  name: string;
  description?: string;
  tier: 0 | 1 | 2 | 3 | 4;
  priceMonthly?: number;
  priceAnnual?: number;
  currency: string;
  setupFee?: number;

  // Limits
  maxUsers: number;
  maxStorageGb: number;
  maxProjects: number;
  maxApiCallsPerDay: number;
  maxTeamMembers?: number;
  maxCustomFields?: number;
  maxIntegrations?: number;
  maxWorkflows?: number;

  // Features & Modules
  features: Record<string, boolean>;
  modules: string[];

  // Support
  supportTier?: 'community' | 'email' | 'priority' | '24x7';
  responseTimeHours?: number;
  uptimeSla?: number;

  // UI
  popular?: boolean;
  recommended?: boolean;
  displayOrder?: number;
}

export interface LicensePlanDisplayInfo {
  key: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaText: string;
  highlighted?: boolean;
}

// ========================================
// Organization License (Subscription)
// ========================================

export interface OrganizationLicense {
  id: string;
  organizationId: string;
  licensePlanId: string;
  subscriptionId?: string;
  subscriptionKey?: string;

  // Status
  status: 'active' | 'trial' | 'suspended' | 'cancelled' | 'expired';

  // Dates
  startedAt: Date;
  expiresAt?: Date;
  trialExpiresAt?: Date;
  renewalDate?: Date;

  // Billing
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  autoRenew: boolean;
  cancelAtPeriodEnd?: boolean;

  // Payment
  paymentMethodId?: string;
  billingEmail?: string;

  // Custom Limits (Overrides)
  customUsersOverride?: number;
  customStorageOverride?: number;
  customProjectsOverride?: number;
  customApiCallsOverride?: number;

  // Metadata
  metadata?: Record<string, any>;
}

export interface LicenseStatus {
  planName: string;
  planTier: number;
  status: string;
  daysRemaining?: number;
  expiresAt?: Date;
  isTrialEnding?: boolean;
  isExpiringSoon?: boolean;
  canUpgrade?: boolean;
}

// ========================================
// Usage Tracking
// ========================================

export interface LicenseUsage {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;

  // Usage Metrics
  activeUsers: number;
  storageUsedGb: number;
  projectsCreated: number;
  apiCallsUsed: number;

  // Advanced Metrics
  teamMembersAdded?: number;
  customFieldsUsed?: number;
  integrationsUsed?: number;
  workflowsCreated?: number;

  // Status
  status: 'active' | 'over_limit' | 'warned';
  warningSent?: boolean;
}

export interface UsageLimitCheck {
  withinLimits: boolean;
  warnings: string[];
  errors: string[];
}

export interface UsageMetric {
  name: string;
  used: number;
  limit: number;
  percentage: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface UsageDashboardData {
  metrics: UsageMetric[];
  periodStart: Date;
  periodEnd: Date;
  resetDate?: Date;
}

// ========================================
// Features & Modules
// ========================================

export interface FeatureEntitlement {
  id: string;
  organizationId: string;
  featureKey: string;
  featureName: string;
  category: string;
  enabled: boolean;
  usageLimit?: number;
  tier?: 0 | 1 | 2;
}

export type FeatureCategory = 'reports' | 'ai' | 'integrations' | 'workflows' | 'advanced';

export interface FeatureSet {
  [key: string]: boolean;
}

export interface ModuleAccess {
  moduleKey: string;
  moduleName: string;
  enabled: boolean;
  accessLevel: 'view' | 'edit' | 'admin' | 'manage';
}

export interface ModuleAccessMap {
  [moduleKey: string]: ModuleAccess;
}

// ========================================
// Upgrade/Downgrade
// ========================================

export interface PlanChangeRequest {
  newPlanId: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  effectiveDate?: Date;
  reason?: string;
}

export interface PlanComparison {
  currentPlan: LicensePlan;
  newPlan: LicensePlan;
  changes: {
    users: { current: number; new: number };
    storage: { current: number; new: number };
    projects: { current: number; new: number };
    price: { current: number; new: number };
    prorationCredit?: number;
  };
}

export interface UpgradeFlow {
  step: 'select' | 'confirm' | 'payment' | 'success';
  selectedPlan?: LicensePlan;
  billingCycle?: 'monthly' | 'quarterly' | 'annual';
  estimatedCost?: number;
}

// ========================================
// Billing & Invoices
// ========================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  stripeInvoiceId?: string;

  // Amounts
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;

  // Dates
  invoiceDate: Date;
  dueDate?: Date;
  paidDate?: Date;

  // Status
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'failed' | 'voided';

  // Line Items
  lineItems?: InvoiceLineItem[];
  pdfUrl?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface BillingHistory {
  invoices: Invoice[];
  totalPaid: number;
  nextBillingDate?: Date;
}

// ========================================
// Notifications
// ========================================

export interface LicenseNotification {
  id: string;
  organizationId: string;
  type: 'trial_ending' | 'renewal_upcoming' | 'usage_warning' | 'expired' | 'failed_payment';
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'clicked' | 'dismissed';
  actionUrl?: string;
  createdAt: Date;
  sentAt?: Date;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  usageAlerts: boolean;
  renewalReminders: boolean;
  promotionalEmails: boolean;
  notificationDaysBeforeExpiry: number;
}

// ========================================
// Request/Response DTOs
// ========================================

export interface GetPlansResponse {
  plans: LicensePlan[];
}

export interface GetLicenseResponse {
  license: OrganizationLicense;
  plan: LicensePlan;
  status: LicenseStatus;
}

export interface GetUsageResponse {
  usage: LicenseUsage;
  limits: UsageLimitCheck;
  metrics: UsageMetric[];
}

export interface GetFeaturesResponse {
  features: FeatureEntitlement[];
  modules: ModuleAccess[];
}

export interface ChangePlanRequest {
  newPlanId: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
}

export interface ChangePlanResponse {
  success: boolean;
  license: OrganizationLicense;
  prorationCredit?: number;
  effectiveDate: Date;
}

export interface ActivateTrialRequest {
  planId: string;
  trialDays?: number;
}

export interface ActivateTrialResponse {
  success: boolean;
  license: OrganizationLicense;
  expiresAt: Date;
}

export interface TrackUsageRequest {
  eventType: string;
  quantity?: number;
  resourceType?: string;
  resourceId?: string;
}

// ========================================
// Constants
// ========================================

export const PLAN_TIERS = {
  FREE: 0,
  STARTER: 1,
  PROFESSIONAL: 2,
  ENTERPRISE: 3,
  CUSTOM: 4,
} as const;

export const PLAN_KEYS = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
  CUSTOM: 'custom',
} as const;

export const BILLING_CYCLES = ['monthly', 'quarterly', 'annual'] as const;

export const LICENSE_STATUSES = ['active', 'trial', 'suspended', 'cancelled', 'expired'] as const;

export const FEATURE_CATEGORIES = [
  'reports',
  'ai',
  'integrations',
  'workflows',
  'advanced',
] as const;

// ========================================
// Usage Event Types
// ========================================

export const USAGE_EVENT_TYPES = {
  FILE_UPLOADED: 'file_uploaded',
  REPORT_GENERATED: 'report_generated',
  API_CALL: 'api_call',
  USER_ADDED: 'user_added',
  PROJECT_CREATED: 'project_created',
  INTEGRATION_CONNECTED: 'integration_connected',
  WORKFLOW_TRIGGERED: 'workflow_triggered',
  AI_REQUEST: 'ai_request',
} as const;
