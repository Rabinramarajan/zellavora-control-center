import { SystemHealthService } from './health.service';

describe('SystemHealthService', () => {
  let service: SystemHealthService;

  beforeEach(() => {
    service = new SystemHealthService();
  });

  it('should return a healthy or degraded dashboard according to service status', async () => {
    const dashboard = await service.getDashboard(true);
    expect(dashboard).toBeDefined();
    expect(['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN']).toContain(dashboard.status);
    expect(dashboard.summary.total).toBeGreaterThan(0);
    expect(dashboard.services.length).toBe(dashboard.summary.total);
    expect(dashboard.services.some((s) => s.id === 'database')).toBe(true);
    expect(dashboard.services.some((s) => s.id === 'auth')).toBe(true);
  });

  it('should check liveness successfully', async () => {
    const liveness = await service.checkLiveness();
    expect(liveness.status).toBe('HEALTHY');
    expect(typeof liveness.uptime).toBe('number');
  });

  it('should evaluate individual services by id', async () => {
    const dbService = await service.getServiceById('database');
    expect(dbService).toBeDefined();
    expect(dbService?.id).toBe('database');
    expect(dbService?.type).toBe('DATABASE');
  });
});
