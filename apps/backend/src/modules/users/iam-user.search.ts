import { z } from 'zod';
import {
  SearchDefinition,
  endOfDay,
  searchDate,
  searchText,
  searchValue,
} from '../../infrastructure/search/search';
import { AccountStatusFilterSchema } from './iam-user.dto';
import { IamUserService } from './iam-user.service';

export const UserSearchCriteriaSchema = z.object({
  userLoginId: searchText(120),
  firstName: searchText(),
  emailId: searchText(),
  contactNumber: searchText(30),
  employeeCode: searchText(60),
  groupId: searchValue(z.string().uuid()),
  statusValue: searchValue(AccountStatusFilterSchema),
  beginFromDate: searchDate(),
  beginToDate: searchDate(),
  endFromDate: searchDate(),
  endToDate: searchDate(),
});

const SORT_COLUMNS = ['fullName', 'employeeCode', 'joiningDate', 'endDate', 'status'] as const;

type UserPage = Awaited<ReturnType<IamUserService['list']>>;

export const userSearch = (
  service = new IamUserService()
): SearchDefinition<
  typeof UserSearchCriteriaSchema.shape,
  (typeof SORT_COLUMNS)[number],
  UserPage['data'][number]
> => ({
  label: 'users',
  criteria: UserSearchCriteriaSchema,
  defaults: {
    userLoginId: null,
    firstName: null,
    emailId: null,
    contactNumber: null,
    employeeCode: null,
    groupId: null,
    statusValue: null,
    beginFromDate: null,
    beginToDate: null,
    endFromDate: null,
    endToDate: null,
  },
  sortColumns: SORT_COLUMNS,
  defaultSort: { column: 'joiningDate', ascending: false },
  run: async (c, { pageNumber, pageSize, sort }) => {
    const page = await service.list({
      username: c.userLoginId,
      firstName: c.firstName,
      email: c.emailId,
      mobile: c.contactNumber,
      employeeCode: c.employeeCode,
      groupId: c.groupId ? [c.groupId] : undefined,
      status: c.statusValue ? [c.statusValue] : undefined,
      beginFrom: c.beginFromDate,
      beginTo: endOfDay(c.beginToDate),
      endFrom: c.endFromDate,
      endTo: endOfDay(c.endToDate),
      page: pageNumber,
      pageSize,
      sort: sort.column,
      order: sort.ascending ? 'asc' : 'desc',
    });
    return { items: page.data, totalCount: page.meta.total };
  },
});
