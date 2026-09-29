// ============================================================================
// ZCC Operations Dashboard — Domain Models
// ============================================================================

export type DashboardRange = '7' | '30' | '90';

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface TrendPoint {
  date: string;
  count: number;
}

export interface DashboardKpis {
  organizations: number;
  members: number;
  activeSessions: number;
  pendingInvitations: number;
  auditEvents24h: number;
  criticalAlerts24h: number;
}

export interface DashboardTrends {
  organizations: TrendPoint[];
  members: TrendPoint[];
  activity: TrendPoint[];
}

export interface ActivityEvent {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string | null;
  severity: AuditSeverity;
  createdAt: string;
}

export interface PlanDistribution {
  plan: string;
  count: number;
}

export interface DashboardOverview {
  generatedAt: string;
  kpis: DashboardKpis;
  trends: DashboardTrends;
  activity: ActivityEvent[];
  planDistribution: PlanDistribution[];
}

export interface ActivityFeedPage {
  items: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityFeedFilters {
  action?: string;
  severity?: AuditSeverity;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}
