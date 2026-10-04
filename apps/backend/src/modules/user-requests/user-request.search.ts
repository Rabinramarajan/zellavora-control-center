import { z } from 'zod';
import { orgContextOf } from '../../middleware/org-context';
import {
  SearchDefinition,
  searchDate,
  searchList,
  searchText,
  searchValue,
} from '../../infrastructure/search/search';
import { REQUEST_STATUSES, REQUEST_TYPES } from './user-request.types';
import { UserRequestService } from './user-request.service';

export const UserRequestSearchCriteriaSchema = z.object({
  requestRefNo: searchText(40),
  requestType: searchList(z.enum(REQUEST_TYPES)),
  fullName: searchText(),
  employeeCode: searchText(60),
  emailId: searchText(),
  requestedBy: searchValue(z.string().uuid()),
  branchId: searchList(z.string().uuid()),
  departmentId: searchList(z.string().uuid()),
  teamId: searchList(z.string().uuid()),
  groupId: searchList(z.string().uuid()),
  roleId: searchList(z.string().uuid()),
  statusValue: searchList(z.enum(REQUEST_STATUSES)),
  requestedFromDate: searchDate(),
  requestedToDate: searchDate(),
});

const SORT_COLUMNS = ['refNo', 'subjectName', 'createdAt', 'status', 'priority'] as const;

type UserRequestPage = Awaited<ReturnType<UserRequestService['list']>>;

export const userRequestSearch = (
  service = new UserRequestService()
): SearchDefinition<
  typeof UserRequestSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  UserRequestPage['data'][number],
  UserRequestPage['counts']
> => ({
  label: 'user requests',
  criteria: UserRequestSearchCriteriaSchema,
  defaults: {
    requestRefNo: null,
    requestType: [],
    fullName: null,
    employeeCode: null,
    emailId: null,
    requestedBy: null,
    branchId: [],
    departmentId: [],
    teamId: [],
    groupId: [],
    roleId: [],
    statusValue: [],
    requestedFromDate: null,
    requestedToDate: null,
  },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'createdAt', ascending: false },
  run: async (c, { pageNumber, pageSize, sort }, req) => {
    const page = await service.list(orgContextOf(req).organizationId, {
      refNo: c.requestRefNo,
      type: c.requestType,
      name: c.fullName,
      employeeCode: c.employeeCode,
      email: c.emailId,
      requestedById: c.requestedBy,
      branchId: c.branchId,
      departmentId: c.departmentId,
      teamId: c.teamId,
      groupId: c.groupId,
      roleId: c.roleId,
      status: c.statusValue,
      from: c.requestedFromDate,
      to: c.requestedToDate,
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total, summary: page.counts };
  },
});
