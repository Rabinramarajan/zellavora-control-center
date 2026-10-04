export interface AuditUserDto {
  id: string | null;
  username: string | null;
  email: string | null;
  name: string | null;
}

export interface AuditSearchItem {
  auditId: string;
  timestamp: string;
  user: AuditUserDto;
  module: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  status: string;
  ipAddress: string | null;
  correlationId: string | null;
}

export interface AuditSearchResult {
  content: AuditSearchItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AuditChangeDiff {
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface AuditDetail {
  auditId: string;
  timestamp: string;
  module: string;
  action: string;
  status: string;
  severity: string;
  actor: {
    userId: string | null;
    username: string | null;
    email: string | null;
    name: string | null;
  };
  resource: {
    type: string | null;
    id: string | null;
    name: string | null;
  };
  request: {
    method: string | null;
    endpoint: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    correlationId: string | null;
  };
  changes: AuditChangeDiff[];
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  error?: {
    code: string | null;
    message: string | null;
  } | null;
}

export interface AuditFilterOptions {
  modules: string[];
  actions: string[];
  resourceTypes: string[];
  statuses: string[];
}

export interface AuditFilterCriteria {
  dateFrom?: string;
  dateTo?: string;
  user?: string;
  module?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  status?: string;
  ipAddress?: string;
  correlationId?: string;
  searchText?: string;
}
