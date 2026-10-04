import { z, ZodError } from 'zod';
import type { AuthRequest } from '../../middleware/auth';
import {
  SearchDefinition,
  dateRange,
  executeSearch,
  searchDate,
  searchDefaults,
  searchList,
  searchText,
} from './search';

const Criteria = z.object({
  name: searchText(),
  tags: searchList(z.string()),
  from: searchDate(),
});

const SORT_COLUMNS = ['name', 'createdAt'] as const;

const define = (
  run: SearchDefinition<typeof Criteria.shape, (typeof SORT_COLUMNS)[number], string>['run']
): SearchDefinition<typeof Criteria.shape, (typeof SORT_COLUMNS)[number], string> => ({
  label: 'widgets',
  criteria: Criteria,
  defaults: { name: null, tags: [], from: null },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'createdAt', ascending: false },
  run,
});

const req = {} as AuthRequest;

describe('search kit', () => {
  it('returns default criteria with standard paging', () => {
    expect(searchDefaults(define(jest.fn()))).toEqual({
      name: null,
      tags: [],
      from: null,
      pageNumber: 1,
      pageSize: 10,
      orderByColumnName: '',
      ascending: true,
    });
  });

  it('accepts the defaults posted back unchanged and applies the default sort', async () => {
    const run = jest.fn().mockResolvedValue({ items: ['a'], totalCount: 31 });
    const def = define(run);

    const res = await executeSearch(def, searchDefaults(def), req);

    expect(run).toHaveBeenCalledWith(
      { name: undefined, tags: undefined, from: undefined },
      { pageNumber: 1, pageSize: 10, sort: { column: 'createdAt', ascending: false } },
      req
    );
    expect(res).toEqual({
      pageNumber: 1,
      pageSize: 10,
      totalCount: 31,
      items: ['a'],
      msg: {
        errorMessage: [],
        infoMessage: {
          id: 4,
          msg: 'Search completed successfully. Total results: 31.',
          msgType: 'Information',
        },
      },
    });
  });

  it('trims text, treats blanks as no filter and coerces dates', async () => {
    const run = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });

    await executeSearch(define(run), { name: '  ada ', tags: ['x'], from: '2026-01-02' }, req);

    expect(run.mock.calls[0][0]).toEqual({
      name: 'ada',
      tags: ['x'],
      from: new Date('2026-01-02'),
    });
  });

  it('honours a whitelisted sort column and direction', async () => {
    const run = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });

    await executeSearch(
      define(run),
      { orderByColumnName: 'name', ascending: false, pageNumber: 3, pageSize: 25 },
      req
    );

    expect(run.mock.calls[0][1]).toEqual({
      pageNumber: 3,
      pageSize: 25,
      sort: { column: 'name', ascending: false },
    });
  });

  it('rejects unknown sort columns and out-of-range paging', async () => {
    const def = define(jest.fn());
    await expect(executeSearch(def, { orderByColumnName: 'password' }, req)).rejects.toThrow(
      ZodError
    );
    await expect(executeSearch(def, { pageSize: 1000 }, req)).rejects.toThrow(ZodError);
    await expect(executeSearch(def, { pageNumber: 0 }, req)).rejects.toThrow(ZodError);
  });

  it('reports an empty result as information, not an error', async () => {
    const res = await executeSearch(
      define(jest.fn().mockResolvedValue({ items: [], totalCount: 0 })),
      {},
      req
    );
    expect(res.items).toEqual([]);
    expect(res.totalCount).toBe(0);
    expect(res.msg.errorMessage).toEqual([]);
    expect(res.msg.infoMessage?.msg).toBe('No widgets found for the given criteria.');
  });

  it('builds inclusive date ranges', () => {
    expect(dateRange()).toBeUndefined();
    const range = dateRange(new Date('2026-01-01'), new Date('2026-01-31'));
    expect(range?.gte).toEqual(new Date('2026-01-01'));
    expect(range?.lte).toEqual(new Date('2026-01-31T23:59:59.999Z'));
  });
});
