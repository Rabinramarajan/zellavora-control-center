import { ChipTone } from '../../../shared/components/iam';
import {
  UserRequestPayload,
  UserRequestPriority,
  UserRequestStatus,
  UserRequestType,
} from '../../../shared/models/user-request.model';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export const REQUEST_TYPE_OPTIONS: Option<UserRequestType>[] = [
  { value: 'NEW_USER', label: 'New User' },
  { value: 'UPDATE_USER', label: 'Update User' },
  { value: 'ACCESS_CHANGE', label: 'Access Change' },
  { value: 'ADD_ROLE', label: 'Add Role' },
  { value: 'REMOVE_ROLE', label: 'Remove Role' },
  { value: 'ADD_GROUP', label: 'Add Group' },
  { value: 'REMOVE_GROUP', label: 'Remove Group' },
  { value: 'TRANSFER', label: 'Branch / Team Transfer' },
  { value: 'ACTIVATE_USER', label: 'Activate User' },
  { value: 'DEACTIVATE_USER', label: 'Deactivate User' },
  { value: 'UNLOCK_ACCOUNT', label: 'Unlock Account' },
  { value: 'RESET_MFA', label: 'Reset MFA' },
];

export const STATUS_OPTIONS: Option<UserRequestStatus>[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROVISIONING', label: 'Provisioning' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SENT_BACK', label: 'Sent Back' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
];

export const STATUS_TONES: Record<UserRequestStatus, ChipTone> = {
  DRAFT: 'gray',
  SUBMITTED: 'blue',
  PENDING_VERIFICATION: 'amber',
  PENDING_APPROVAL: 'amber',
  APPROVED: 'purple',
  PROVISIONING: 'blue',
  COMPLETED: 'green',
  REJECTED: 'red',
  SENT_BACK: 'rose',
  CANCELLED: 'gray',
  FAILED: 'red',
};

export const PRIORITY_OPTIONS: Option<UserRequestPriority>[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const USER_TYPE_OPTIONS: Option[] = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'EXTERNAL', label: 'External' },
];

export const EMPLOYMENT_TYPE_OPTIONS: Option[] = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'EXTERNAL', label: 'External' },
];

export const ACCESS_SCOPE_OPTIONS: Option[] = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'TEAM', label: 'Team' },
  { value: 'OWN', label: 'Own Records' },
];

export const NOTE_TYPE_OPTIONS: Option[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'APPROVAL', label: 'Approval' },
  { value: 'PROVISIONING', label: 'Provisioning' },
];

export const NOTE_VISIBILITY_OPTIONS: Option[] = [
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'REQUESTER', label: 'Visible to requester' },
];

export const labelOf = (options: readonly Option[], value: string | null | undefined): string =>
  options.find((o) => o.value === value)?.label ?? value ?? '—';

/** Which form sections a request type needs. */
export interface TypeSections {
  user: boolean;
  employee: boolean;
  contact: boolean;
  organization: boolean;
  addGroups: boolean;
  removeGroups: boolean;
  addRoles: boolean;
  removeRoles: boolean;
}

const NONE: TypeSections = {
  user: false,
  employee: false,
  contact: false,
  organization: false,
  addGroups: false,
  removeGroups: false,
  addRoles: false,
  removeRoles: false,
};

export const sectionsFor = (type: UserRequestType): TypeSections => {
  switch (type) {
    case 'NEW_USER':
      return {
        ...NONE,
        user: true,
        employee: true,
        contact: true,
        organization: true,
        addGroups: true,
        addRoles: true,
      };
    case 'UPDATE_USER':
      return { ...NONE, user: true, employee: true, contact: true };
    case 'ACCESS_CHANGE':
      return { ...NONE, addGroups: true, removeGroups: true, addRoles: true, removeRoles: true };
    case 'ADD_ROLE':
      return { ...NONE, addRoles: true };
    case 'REMOVE_ROLE':
      return { ...NONE, removeRoles: true };
    case 'ADD_GROUP':
      return { ...NONE, addGroups: true };
    case 'REMOVE_GROUP':
      return { ...NONE, removeGroups: true };
    case 'TRANSFER':
      return {
        ...NONE,
        organization: true,
        addGroups: true,
        removeGroups: true,
        addRoles: true,
        removeRoles: true,
      };
    default:
      return NONE;
  }
};

export const hasAccessChanges = (s: TypeSections): boolean =>
  s.addGroups || s.removeGroups || s.addRoles || s.removeRoles;

/** Form-side payload: every text field is a string, '' meaning "not provided". */
export type FormPayload = {
  [S in keyof UserRequestPayload]: {
    [K in keyof UserRequestPayload[S]]: UserRequestPayload[S][K] extends string[]
      ? string[]
      : string;
  };
};

export const emptyPayload = (): FormPayload => ({
  user: {
    username: '',
    firstName: '',
    middleName: '',
    lastName: '',
    displayName: '',
    userType: '',
  },
  employee: {
    employeeCode: '',
    employmentType: '',
    designation: '',
    joiningDate: '',
    company: '',
    workLocation: '',
  },
  contact: {
    workEmail: '',
    contactNumber: '',
    alternateEmail: '',
    alternateContactNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  },
  organization: {
    branchId: '',
    departmentId: '',
    teamId: '',
    reportingManagerId: '',
    assignedOfficerId: '',
    costCenter: '',
    location: '',
    accessScope: '',
  },
  access: { addGroupIds: [], removeGroupIds: [], addRoleIds: [], removeRoleIds: [] },
});

/** Stored payload → form draft (nulls become '', dates trimmed to yyyy-mm-dd). */
export const toFormPayload = (p: UserRequestPayload): FormPayload => {
  const draft = emptyPayload();
  for (const section of Object.keys(draft) as Array<keyof FormPayload>) {
    const target = draft[section] as Record<string, unknown>;
    const source = p[section] as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      const v = source?.[key];
      target[key] = Array.isArray(v) ? [...v] : typeof v === 'string' ? v : '';
    }
  }
  draft.employee.joiningDate = draft.employee.joiningDate.slice(0, 10);
  return draft;
};

/** Form draft → API payload ('' becomes null, text trimmed). */
export const toApiPayload = (draft: FormPayload): UserRequestPayload =>
  Object.fromEntries(
    Object.entries(draft).map(([section, fields]) => [
      section,
      Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [
          k,
          Array.isArray(v) ? v : (v as string).trim() || null,
        ])
      ),
    ])
  ) as unknown as UserRequestPayload;
