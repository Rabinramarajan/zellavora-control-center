import { z } from 'zod';
import { SearchDefinition, searchText, searchValue } from '../../infrastructure/search/search';
import { EntityStatusSchema, ResourceTypeSchema } from './resource.dto';
import { ResourceService } from './resource.service';

export const ResourceSearchCriteriaSchema = z.object({
  resourceName: searchText(),
  resourceType: searchValue(ResourceTypeSchema),
  category: searchText(60),
  statusValue: searchValue(EntityStatusSchema),
});

const SORT_COLUMNS = ['name', 'type', 'category', 'createdAt'] as const;

type ResourcePage = Awaited<ReturnType<ResourceService['list']>>;

export const resourceSearch = (
  service = new ResourceService()
): SearchDefinition<
  typeof ResourceSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  ResourcePage['data'][number]
> => ({
  label: 'resources',
  criteria: ResourceSearchCriteriaSchema,
  defaults: { resourceName: null, resourceType: null, category: null, statusValue: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'name', ascending: true },
  run: async (c, { pageNumber, pageSize, sort }) => {
    const page = await service.list({
      q: c.resourceName,
      type: c.resourceType ? [c.resourceType] : undefined,
      category: c.category,
      status: c.statusValue ? [c.statusValue] : undefined,
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total };
  },
});
