import { z } from 'zod';
import { SearchDefinition, searchText, searchValue } from '../../infrastructure/search/search';
import { EntityStatusSchema, GroupTypeSchema } from './group.dto';
import { GroupService } from './group.service';

export const GroupSearchCriteriaSchema = z.object({
  groupName: searchText(),
  groupType: searchValue(GroupTypeSchema),
  statusValue: searchValue(EntityStatusSchema),
  parentGroupId: searchValue(z.string().uuid()),
});

const SORT_COLUMNS = ['name', 'type', 'status', 'createdAt'] as const;

type GroupPage = Awaited<ReturnType<GroupService['list']>>;

export const groupSearch = (
  service = new GroupService()
): SearchDefinition<
  typeof GroupSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  GroupPage['data'][number]
> => ({
  label: 'groups',
  criteria: GroupSearchCriteriaSchema,
  defaults: { groupName: null, groupType: null, statusValue: null, parentGroupId: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'name', ascending: true },
  run: async (c, { pageNumber, pageSize, sort }) => {
    const page = await service.list({
      q: c.groupName,
      type: c.groupType ? [c.groupType] : undefined,
      status: c.statusValue ? [c.statusValue] : undefined,
      parentId: c.parentGroupId,
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total };
  },
});
