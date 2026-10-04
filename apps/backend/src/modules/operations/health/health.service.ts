import {
  ApplicationHealthChecker,
  AuthHealthChecker,
  CacheHealthChecker,
  DatabaseHealthChecker,
  IHealthChecker,
  QueueHealthChecker,
  StorageHealthChecker,
} from './health.checkers';
import { HealthStatus, ServiceHealthResult, SystemHealthDashboard } from './health.types';

export class SystemHealthService {
  private readonly checkers: IHealthChecker[] = [
    new ApplicationHealthChecker(),
    new DatabaseHealthChecker(),
    new AuthHealthChecker(),
    new StorageHealthChecker(),
    new CacheHealthChecker(),
    new QueueHealthChecker(),
  ];

  // Lightweight 10-second cache to prevent health spamming from overloading underlying dependencies
  private cachedDashboard: SystemHealthDashboard | null = null;
  private cacheExpiresAt = 0;

  async getDashboard(forceFresh = false): Promise<SystemHealthDashboard> {
    const now = Date.now();
    if (!forceFresh && this.cachedDashboard && now < this.cacheExpiresAt) {
      return this.cachedDashboard;
    }

    const services = await Promise.all(this.checkers.map((c) => c.check()));
    const status = this.calculateOverallStatus(services);

    const summary = {
      total: services.length,
      healthy: services.filter((s) => s.status === 'HEALTHY').length,
      degraded: services.filter((s) => s.status === 'DEGRADED').length,
      down: services.filter((s) => s.status === 'DOWN').length,
      unknown: services.filter((s) => s.status === 'UNKNOWN').length,
    };

    const dashboard: SystemHealthDashboard = {
      status,
      checkedAt: new Date().toISOString(),
      summary,
      services,
    };

    this.cachedDashboard = dashboard;
    this.cacheExpiresAt = now + 10000; // 10s TTL
    return dashboard;
  }

  async getServices(): Promise<ServiceHealthResult[]> {
    const dashboard = await this.getDashboard();
    return dashboard.services;
  }

  async getServiceById(id: string): Promise<ServiceHealthResult | null> {
    const checker = this.checkers.find((c) => c.id.toLowerCase() === id.toLowerCase());
    if (!checker) return null;
    return checker.check();
  }

  /**
   * Liveness: Lightweight check determining whether the Node.js process is alive.
   */
  async checkLiveness(): Promise<{ status: 'HEALTHY'; uptime: number; timestamp: string }> {
    return {
      status: 'HEALTHY',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness: Verifies that critical core dependencies (database) are ready to serve user traffic.
   */
  async checkReadiness(): Promise<{
    status: 'HEALTHY' | 'DOWN';
    database: string;
    timestamp: string;
  }> {
    const dbChecker = new DatabaseHealthChecker();
    const dbResult = await dbChecker.check();
    const isReady = dbResult.status !== 'DOWN';

    return {
      status: isReady ? 'HEALTHY' : 'DOWN',
      database: dbResult.status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Overall status calculation rules:
   * - If any critical service is DOWN: Overall = DOWN
   * - Else if one or more services are DEGRADED: Overall = DEGRADED
   * - Else if all required services are HEALTHY: Overall = HEALTHY
   * - Otherwise: UNKNOWN
   */
  private calculateOverallStatus(services: ServiceHealthResult[]): HealthStatus {
    const hasCriticalDown = services.some((s) => s.critical && s.status === 'DOWN');
    if (hasCriticalDown) {
      return 'DOWN';
    }

    const hasAnyDown = services.some((s) => s.status === 'DOWN');
    const hasDegraded = services.some((s) => s.status === 'DEGRADED');
    if (hasAnyDown || hasDegraded) {
      return 'DEGRADED';
    }

    const allHealthy = services.every((s) => s.status === 'HEALTHY');
    if (allHealthy && services.length > 0) {
      return 'HEALTHY';
    }

    return 'UNKNOWN';
  }
}
