import { z } from 'zod';
import { SearchDefinition, searchText, searchValue } from '../../infrastructure/search/search';
import { EntityStatusSchema, RoleScopeSchema } from './role.dto';
import { RoleService } from './role.service';

export const RoleSearchCriteriaSchema = z.object({
  roleName: searchText(),
  scope: searchValue(RoleScopeSchema),
  statusValue: searchValue(EntityStatusSchema),
});

const SORT_COLUMNS = ['name', 'scope', 'status', 'createdAt'] as const;

type RolePage = Awaited<ReturnType<RoleService['list']>>;

export const roleSearch = (
  service = new RoleService()
): SearchDefinition<
  typeof RoleSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  RolePage['data'][number]
> => ({
  label: 'roles',
  criteria: RoleSearchCriteriaSchema,
  defaults: { roleName: null, scope: null, statusValue: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'name', ascending: true },
  run: async (c, { pageNumber, pageSize, sort }) => {
    const page = await service.list({
      q: c.roleName,
      scope: c.scope ? [c.scope] : undefined,
      status: c.statusValue ? [c.statusValue] : undefined,
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total };
  },
});
