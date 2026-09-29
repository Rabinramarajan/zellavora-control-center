export interface AuditRecord {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  severity: 'info' | 'warn' | 'critical';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
