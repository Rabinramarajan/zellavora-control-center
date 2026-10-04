export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export type HealthServiceType =
  | 'APPLICATION'
  | 'DATABASE'
  | 'AUTHENTICATION'
  | 'STORAGE'
  | 'EMAIL'
  | 'QUEUE'
  | 'CACHE'
  | 'EXTERNAL_API'
  | 'WORKER'
  | 'OTHER';

export interface ServiceHealthResult {
  id: string;
  name: string;
  type: HealthServiceType;
  status: HealthStatus;
  critical: boolean;
  responseTimeMs: number;
  lastCheckedAt: string;
  message: string;
  details?: Record<string, unknown>;
  error?: {
    code?: string;
    message: string;
    failedAt?: string;
  };
}

export interface SystemHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
}

export interface SystemHealthDashboard {
  status: HealthStatus;
  checkedAt: string;
  summary: SystemHealthSummary;
  services: ServiceHealthResult[];
}
