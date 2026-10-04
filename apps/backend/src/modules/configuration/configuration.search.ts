import { z } from 'zod';
import { orgContextOf } from '../../middleware/org-context';
import { SearchDefinition, searchText } from '../../infrastructure/search/search';
import { ConfigurationService } from './configuration.service';

export const ConfigurationSearchCriteriaSchema = z.object({
  configKey: searchText(),
  category: searchText(60),
});

const SORT_COLUMNS = ['key', 'category', 'updatedAt'] as const;

type ConfigurationPage = Awaited<ReturnType<ConfigurationService['list']>>;

export const configurationSearch = (
  service = new ConfigurationService()
): SearchDefinition<
  typeof ConfigurationSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  ConfigurationPage['data'][number],
  { categories: string[] }
> => ({
  label: 'configurations',
  criteria: ConfigurationSearchCriteriaSchema,
  defaults: { configKey: null, category: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'category', ascending: true },
  run: async (c, { pageNumber, pageSize, sort }, req) => {
    const page = await service.list(orgContextOf(req).organizationId, {
      q: c.configKey,
      category: c.category,
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return {
      items: page.data,
      totalCount: page.meta.total,
      summary: { categories: page.categories },
    };
  },
});
