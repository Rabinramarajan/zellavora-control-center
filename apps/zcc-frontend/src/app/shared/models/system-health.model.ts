export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'failed';
  latencyMs: number;
  message?: string;
}

export interface ResourceUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface SystemMetrics {
  cpu: ResourceUsage;
  ram: ResourceUsage;
  database: ServiceStatus;
  storage: ServiceStatus;
  redis: ServiceStatus;
  queue: {
    pendingJobs: number;
    activeWorkers: number;
    status: 'healthy' | 'degraded' | 'failed';
  };
  timestamp: string;
}
