// ============================================================================
// ZCC Operations Dashboard — Domain Models
// ============================================================================

export type DashboardRange = '7' | '30' | '90';

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * Which view the API computed. Organization accounts get tenant-wide metrics;
 * INDIVIDUAL accounts get a personal set scoped to their own user id.
 */
export type DashboardScope = 'organization' | 'individual';

export type TrendSeriesKey = 'primary' | 'secondary' | 'activity';

export interface TrendPoint {
  date: string;
  count: number;
}

/** A KPI card. The API chooses the set, so the UI stays scope-agnostic. */
export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  hint: string;
  series: TrendSeriesKey | null;
}

export interface DashboardTrends {
  /** Organizations (org scope) or your projects (individual scope). */
  primary: TrendPoint[];
  /** Members (org scope) or your daily sheets (individual scope). */
  secondary: TrendPoint[];
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

/** Copy for the donut panel, supplied by the API so it reads right per scope. */
export interface DashboardPanel {
  title: string;
  subtitle: string;
  chip: string;
  totalLabel: string;
  emptyTitle: string;
  emptyHint: string;
}

export interface DashboardOverview {
  generatedAt: string;
  scope: DashboardScope;
  kpis: DashboardKpi[];
  trendLegend: { primary: string; secondary: string };
  trends: DashboardTrends;
  activity: ActivityEvent[];
  panel: DashboardPanel;
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
