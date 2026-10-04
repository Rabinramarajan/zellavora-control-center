import { z } from 'zod';
import { SearchDefinition, searchText, searchValue } from '../../infrastructure/search/search';
import { AuditStatusEnum } from './audit.dto';
import { AuditService } from './audit.service';

/** `YYYY-MM-DD` or an ISO date-time; a bare date as `toDate` covers that whole day. */
const auditDate = searchValue(
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/, 'Invalid date')
);

export const AuditSearchCriteriaSchema = z.object({
  fromDate: auditDate,
  toDate: auditDate,
  changedBy: searchText(),
  moduleName: searchText(80),
  action: searchText(80),
  resourceType: searchText(80),
  resourceId: searchText(120),
  statusValue: searchValue(AuditStatusEnum),
  ipAddress: searchText(60),
  correlationId: searchText(120),
  searchText: searchText(),
});

const SORT_COLUMNS = ['createdAt', 'action', 'module', 'status', 'user', 'resourceType'] as const;

type AuditPage = Awaited<ReturnType<AuditService['searchLogs']>>;

export const auditSearch = (
  service = new AuditService()
): SearchDefinition<
  typeof AuditSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  AuditPage['content'][number]
> => ({
  label: 'audit records',
  criteria: AuditSearchCriteriaSchema,
  defaults: {
    fromDate: null,
    toDate: null,
    changedBy: null,
    moduleName: null,
    action: null,
    resourceType: null,
    resourceId: null,
    statusValue: null,
    ipAddress: null,
    correlationId: null,
    searchText: null,
  },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'createdAt', ascending: false },
  run: async (c, { pageNumber, pageSize, sort }, req) => {
    const page = await service.searchLogs(req.tenantId, {
      dateFrom: c.fromDate,
      dateTo: c.toDate,
      user: c.changedBy,
      module: c.moduleName,
      action: c.action,
      resourceType: c.resourceType,
      resourceId: c.resourceId,
      status: c.statusValue,
      ipAddress: c.ipAddress,
      correlationId: c.correlationId,
      searchText: c.searchText,
      page: pageNumber,
      size: pageSize,
      sort: `${sort.column},${sort.ascending ? 'asc' : 'desc'}`,
    });
    return { items: page.content, totalCount: page.totalElements };
  },
});
