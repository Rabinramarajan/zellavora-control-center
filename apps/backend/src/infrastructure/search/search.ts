/**
 * Standard search contract shared by every search screen.
 *
 *   GET  {module}/search/criteria  -> default SearchRequest (filters + paging/sorting)
 *   POST {module}/search           -> SearchResponse for the posted SearchRequest
 *
 * A module defines its own filter schema and a `run` function that applies the filters,
 * sorting and paging in its repository; this file owns everything that must behave the
 * same on every screen: paging limits, sort-column whitelisting, empty-value
 * normalization, the response shape and the result message.
 */
import type { RequestHandler, Response, Router } from 'express';
import { z, ZodObject, ZodRawShape } from 'zod';
import type { AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';

export const DEFAULT_SEARCH_PAGE_SIZE = 10;
export const MAX_SEARCH_PAGE_SIZE = 100;

export interface SearchMessageItem {
  id: number;
  msg: string;
  msgType: 'Information' | 'Warning' | 'Error';
}

export interface SearchMessage {
  errorMessage: SearchMessageItem[];
  infoMessage: SearchMessageItem | null;
}

export interface SearchPaging {
  pageNumber: number;
  pageSize: number;
  /** Empty string means "use the module's default order". */
  orderByColumnName: string;
  ascending: boolean;
}

export type SearchRequest<TCriteria> = TCriteria & SearchPaging;

export interface SearchResponse<TItem, TSummary = undefined> {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  items: TItem[];
  /** Module-specific aggregates (e.g. per-status counts) that are independent of paging. */
  summary?: TSummary;
  msg: SearchMessage;
}

/** Resolved sort handed to a module's `run`; the column is always whitelisted. */
export interface SearchSort<TColumn extends string> {
  column: TColumn;
  ascending: boolean;
}

export interface SearchPage<TItem, TSummary = undefined> {
  items: TItem[];
  totalCount: number;
  summary?: TSummary;
}

// ---------------------------------------------------------------------------
// Filter field helpers: every one accepts null/absent/"" and normalizes to undefined,
// so the GET defaults (all null) can be posted straight back.
// ---------------------------------------------------------------------------

/** A filter that accepts null/blank input and yields `TOut | undefined`. */
type SearchField<TSchema extends z.ZodTypeAny> = z.ZodEffects<
  z.ZodOptional<TSchema>,
  z.output<TSchema> | undefined,
  unknown
>;

const blankToUndefined = (value: unknown): unknown =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

/** Free-text filter, trimmed; blank means "no filter". */
export const searchText = (max = 200): SearchField<z.ZodString> =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

/** Single exact-match id/enum filter; blank means "no filter". */
export const searchValue = <T extends z.ZodTypeAny>(schema: T): SearchField<T> =>
  z.preprocess(blankToUndefined, schema.optional());

/** Multi-value filter; an empty list means "no filter". */
export const searchList = <T extends z.ZodTypeAny>(schema: T): SearchField<z.ZodArray<T>> =>
  z.preprocess(
    (value) => (Array.isArray(value) && value.length === 0 ? undefined : blankToUndefined(value)),
    z.array(schema).max(100).optional()
  );

/** Calendar date filter (`YYYY-MM-DD` or ISO date-time). */
export const searchDate = (): SearchField<z.ZodDate> =>
  z.preprocess(blankToUndefined, z.coerce.date({ invalid_type_error: 'Invalid date' }).optional());

/** Last millisecond of a "to" date's day, so a range ending today includes today's records. */
export const endOfDay = (to?: Date): Date | undefined =>
  to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined;

/** Inclusive date range bounds for a `[from, to]` pair, or undefined when both are empty. */
export function dateRange(from?: Date, to?: Date): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: endOfDay(to) } : {}) };
}

const PagingSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SEARCH_PAGE_SIZE)
    .default(DEFAULT_SEARCH_PAGE_SIZE),
  orderByColumnName: z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.string().trim().max(60)
  ),
  ascending: z.preprocess((v) => (v === null || v === undefined ? true : v), z.boolean()),
});

export interface SearchDefinition<
  TShape extends ZodRawShape,
  TColumn extends string,
  TItem,
  TSummary = undefined,
> {
  /** Plural noun used in the result message, e.g. "user requests". */
  label: string;
  /** Module filters. Use the `search*` helpers so blank values are ignored. */
  criteria: ZodObject<TShape>;
  /** Initial filter values returned by the criteria endpoint (normally all null / []). */
  defaults: { [K in keyof TShape]: unknown };
  /** Columns the client may order by; anything else is a validation error. */
  sortColumns: readonly TColumn[];
  /** Order applied when `orderByColumnName` is empty. */
  defaultSort: SearchSort<TColumn>;
  run: (
    criteria: z.infer<ZodObject<TShape>>,
    paging: { pageNumber: number; pageSize: number; sort: SearchSort<TColumn> },
    req: AuthRequest
  ) => Promise<SearchPage<TItem, TSummary>>;
}

const resultMessage = (label: string, totalCount: number): SearchMessage => ({
  errorMessage: [],
  infoMessage: {
    id: totalCount ? 4 : 5,
    msg: totalCount
      ? `Search completed successfully. Total results: ${totalCount}.`
      : `No ${label} found for the given criteria.`,
    msgType: 'Information',
  },
});

/** The criteria a screen starts from; also what Reset restores. */
export function searchDefaults<TDefaults extends object>(def: {
  defaults: TDefaults;
}): SearchRequest<TDefaults> {
  return {
    ...def.defaults,
    pageNumber: 1,
    pageSize: DEFAULT_SEARCH_PAGE_SIZE,
    orderByColumnName: '',
    ascending: true,
  };
}

/** Validates and runs one search request. Exposed separately for unit tests. */
export async function executeSearch<
  TShape extends ZodRawShape,
  TColumn extends string,
  TItem,
  TSummary,
>(
  def: SearchDefinition<TShape, TColumn, TItem, TSummary>,
  body: unknown,
  req: AuthRequest
): Promise<SearchResponse<TItem, TSummary>> {
  const input = (body ?? {}) as Record<string, unknown>;
  const paging = PagingSchema.parse(input);
  const criteria = def.criteria.parse(input);

  let sort = def.defaultSort;
  if (paging.orderByColumnName) {
    const column = def.sortColumns.find((c) => c === paging.orderByColumnName);
    if (!column) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: ['orderByColumnName'],
          message: `Cannot sort by "${paging.orderByColumnName}". Allowed: ${def.sortColumns.join(', ')}.`,
        },
      ]);
    }
    sort = { column, ascending: paging.ascending };
  }

  const page = await def.run(
    criteria,
    { pageNumber: paging.pageNumber, pageSize: paging.pageSize, sort },
    req
  );
  return {
    pageNumber: paging.pageNumber,
    pageSize: paging.pageSize,
    totalCount: page.totalCount,
    items: page.items,
    ...(page.summary !== undefined ? { summary: page.summary } : {}),
    msg: resultMessage(def.label, page.totalCount),
  };
}

/**
 * Registers `GET /search/criteria` and `POST /search` on a module router. Call it before
 * any `/:id` routes so "search" is never captured as an id.
 */
export function mountSearchRoutes<
  TShape extends ZodRawShape,
  TColumn extends string,
  TItem,
  TSummary,
>(
  router: Router,
  def: SearchDefinition<TShape, TColumn, TItem, TSummary>,
  guards: RequestHandler[],
  basePath = ''
): void {
  router.get(`${basePath}/search/criteria`, ...guards, (_req, res: Response) => {
    res.json({ success: true, data: searchDefaults(def) });
  });
  router.post(
    `${basePath}/search`,
    ...guards,
    asyncHandler<AuthRequest>(async (req, res) => {
      res.json({ success: true, data: await executeSearch(def, req.body, req) });
    })
  );
}
