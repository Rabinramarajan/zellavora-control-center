import { z } from 'zod';
import { orgContextOf } from '../../middleware/org-context';
import { SearchDefinition, searchText, searchValue } from '../../infrastructure/search/search';
import { BranchStatusSchema } from './branch.dto';
import { BranchService } from './branch.service';

export const BranchSearchCriteriaSchema = z.object({
  /** Matches name, code or city. */
  branchName: searchText(),
  statusValue: searchValue(BranchStatusSchema),
});

const SORT_COLUMNS = ['code', 'name', 'city', 'status', 'updatedAt'] as const;

type BranchPage = Awaited<ReturnType<BranchService['list']>>;

export const branchSearch = (
  service = new BranchService()
): SearchDefinition<
  typeof BranchSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  BranchPage['data'][number]
> => ({
  label: 'branches',
  criteria: BranchSearchCriteriaSchema,
  defaults: { branchName: null, statusValue: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'name', ascending: true },
  run: async (c, { pageNumber, pageSize, sort }, req) => {
    const page = await service.list(orgContextOf(req).organizationId, {
      q: c.branchName,
      status: c.statusValue,
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total };
  },
});
