import { z } from 'zod';
import { orgContextOf } from '../../middleware/org-context';
import { SearchDefinition, searchDate, searchText } from '../../infrastructure/search/search';
import { HistoryQuery } from './communications.dto';
import { CommunicationsService } from './communications.service';

export const CommunicationSearchCriteriaSchema = z.object({
  subject: searchText(),
  sentFromDate: searchDate(),
  sentToDate: searchDate(),
});

const SORT_COLUMNS = ['sentAt'] as const;

type HistoryPage = Awaited<ReturnType<CommunicationsService['history']>>;

/** Message Search (in-app) and Email Communication Search share one shape per channel. */
export const communicationSearch = (
  channel: HistoryQuery['channel'],
  service = new CommunicationsService()
): SearchDefinition<
  typeof CommunicationSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  HistoryPage['data'][number]
> => ({
  label: channel === 'email' ? 'emails' : 'messages',
  criteria: CommunicationSearchCriteriaSchema,
  defaults: { subject: null, sentFromDate: null, sentToDate: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'sentAt', ascending: false },
  run: async (c, { pageNumber, pageSize, sort }, req) => {
    const page = await service.history(orgContextOf(req).organizationId, {
      channel,
      subject: c.subject,
      sentFrom: c.sentFromDate,
      sentTo: c.sentToDate,
      page: pageNumber,
      pageSize,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total };
  },
});
