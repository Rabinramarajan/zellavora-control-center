import {
  FormDialogConfig,
  FormDialogMode,
  FormDialogValues,
  FormSectionDef,
} from '../../../shared/components/form-dialog';
import {
  CopyRoleRequest,
  EntityStatus,
  RoleDetail,
  RoleScope,
  SaveRoleRequest,
} from '../../../shared/models/iam.model';
import { ChipTone } from '../../../shared/components/iam';

export const ROLE_SCOPE_OPTIONS: Array<{ value: RoleScope; label: string }> = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'ORG', label: 'Organization' },
  { value: 'RESOURCE', label: 'Resource' },
];

export const ROLE_STATUS_OPTIONS: Array<{ value: EntityStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const SCOPE_TONES: Record<RoleScope, ChipTone> = {
  GLOBAL: 'purple',
  ORG: 'blue',
  RESOURCE: 'amber',
};

export const roleScopeTone = (scope: string): ChipTone => SCOPE_TONES[scope as RoleScope] ?? 'gray';

export const roleScopeLabel = (scope: string): string =>
  ROLE_SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? scope;

export const roleStatusLabel = (status: string): string =>
  status === 'ACTIVE' ? 'Active' : 'Inactive';

const sections = (current?: RoleDetail): FormSectionDef[] => [
  {
    title: 'Role Information',
    fields: [
      {
        key: 'name',
        label: 'Role Name',
        type: 'text',
        required: true,
        minLength: 2,
        maxLength: 120,
        placeholder: 'e.g. Finance Manager',
        // System roles are referenced by key across the platform.
        readonly: current?.isSystem === true,
        hint: current?.isSystem
          ? 'System roles cannot be renamed.'
          : current
            ? undefined
            : 'The role key is generated from the name.',
      },
      {
        key: 'scope',
        label: 'Scope',
        type: 'select',
        required: true,
        options: ROLE_SCOPE_OPTIONS,
        readonly: current?.isSystem === true,
        hint: 'Global roles apply everywhere; organization roles apply within one organization.',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        displayAs: 'status',
        options: ROLE_STATUS_OPTIONS,
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        maxLength: 500,
        span: 2,
        placeholder: 'What this role allows and who should hold it',
      },
    ],
  },
];

const toValues = (r?: RoleDetail): FormDialogValues => ({
  name: r?.name ?? '',
  scope: r?.scope ?? 'ORG',
  status: r?.status ?? 'ACTIVE',
  description: r?.description ?? '',
});

const text = (v: FormDialogValues, key: string): string =>
  typeof v[key] === 'string' ? (v[key] as string).trim() : '';

/** Maps dialog values to the API request; read-only fields are already excluded. */
export const toRoleRequest = (v: FormDialogValues, current?: RoleDetail): SaveRoleRequest => ({
  name: text(v, 'name') || current?.name || '',
  scope: (text(v, 'scope') || current?.scope || 'ORG') as RoleScope,
  status: text(v, 'status') === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  description: text(v, 'description') || null,
});

export const roleDialogConfig = (
  mode: FormDialogMode,
  save: FormDialogConfig<RoleDetail>['save'],
  role?: RoleDetail
): FormDialogConfig<RoleDetail> => ({
  mode,
  title: { create: 'Create Role', edit: 'Edit Role' },
  subtitle: {
    create: 'Create the role, then choose its permissions.',
    edit: 'Update the role details and save your changes.',
  },
  badge: role?.key,
  submitText: { create: 'Create Role', edit: 'Save Changes' },
  sections: sections(role),
  value: toValues(role),
  save,
});

export const copyRoleDialogConfig = (
  source: RoleDetail,
  save: FormDialogConfig<RoleDetail>['save']
): FormDialogConfig<RoleDetail> => ({
  mode: 'create',
  title: { create: `Copy ${source.name}` },
  subtitle: { create: 'Create a new role starting from this one.' },
  submitText: { create: 'Copy Role' },
  sections: [
    {
      title: 'New Role',
      fields: [
        {
          key: 'name',
          label: 'Role Name',
          type: 'text',
          required: true,
          minLength: 2,
          maxLength: 120,
          span: 2,
        },
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 3,
          maxLength: 500,
          span: 2,
        },
        {
          key: 'includePermissions',
          label: 'Permissions',
          type: 'toggle',
          inlineLabel: `Copy all ${source.permissionCount} permissions`,
          span: 2,
        },
      ],
    },
  ],
  value: {
    name: `${source.name} (Copy)`,
    description: source.description ?? '',
    includePermissions: true,
  },
  save,
});

export const toCopyRequest = (v: FormDialogValues): CopyRoleRequest => ({
  name: text(v, 'name'),
  description: text(v, 'description') || null,
  includePermissions: v['includePermissions'] === true,
});
