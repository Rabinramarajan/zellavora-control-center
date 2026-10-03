import {
  FormDialogConfig,
  FormDialogMode,
  FormDialogValues,
  FormFieldOption,
  FormSectionDef,
} from '../../../shared/components/form-dialog';
import {
  EntityStatus,
  GroupDetail,
  GroupType,
  SaveGroupRequest,
} from '../../../shared/models/iam.model';
import { ChipTone } from '../../../shared/components/iam';

export const GROUP_TYPE_OPTIONS: Array<{ value: GroupType; label: string }> = [
  { value: 'SECURITY', label: 'Security' },
  { value: 'ORG', label: 'Organization' },
  { value: 'DISTRIBUTION', label: 'Distribution' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'DYNAMIC', label: 'Dynamic' },
];

export const GROUP_STATUS_OPTIONS: Array<{ value: EntityStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const GROUP_TYPE_TONES: Record<GroupType, ChipTone> = {
  SECURITY: 'purple',
  ORG: 'blue',
  DISTRIBUTION: 'amber',
  PROJECT: 'green',
  DYNAMIC: 'rose',
};

export const groupTypeTone = (type: string): ChipTone =>
  GROUP_TYPE_TONES[type as GroupType] ?? 'gray';

export const groupTypeLabel = (type: string): string =>
  GROUP_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

export const groupStatusLabel = (status: string): string =>
  status === 'ACTIVE' ? 'Active' : 'Inactive';

const sections = (parents: FormFieldOption[], current?: GroupDetail): FormSectionDef[] => [
  {
    title: 'Group Information',
    fields: [
      {
        key: 'name',
        label: 'Group Name',
        type: 'text',
        required: true,
        minLength: 2,
        maxLength: 120,
        placeholder: 'e.g. Finance Approvers',
        // System groups are referenced by name and cannot be renamed.
        readonly: current?.isSystem === true,
        hint: current?.isSystem ? 'System groups cannot be renamed.' : undefined,
      },
      {
        key: 'type',
        label: 'Group Type',
        type: 'select',
        required: true,
        options: GROUP_TYPE_OPTIONS,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        displayAs: 'status',
        options: GROUP_STATUS_OPTIONS,
      },
      {
        key: 'parentId',
        label: 'Parent Group',
        type: 'select',
        options: [{ value: '', label: 'None (top level)' }, ...parents],
        hint: 'Members of this group also inherit the parent group roles.',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        maxLength: 500,
        span: 2,
        placeholder: 'What this group is for and who belongs in it',
      },
    ],
  },
];

const toValues = (g?: GroupDetail): FormDialogValues => ({
  name: g?.name ?? '',
  type: g?.type ?? 'SECURITY',
  status: g?.status ?? 'ACTIVE',
  parentId: g?.parentId ?? '',
  description: g?.description ?? '',
});

const text = (v: FormDialogValues, key: string): string =>
  typeof v[key] === 'string' ? (v[key] as string).trim() : '';

/** Maps dialog values to the API request; read-only fields are already excluded. */
export const toGroupRequest = (v: FormDialogValues, current?: GroupDetail): SaveGroupRequest => ({
  name: text(v, 'name') || current?.name || '',
  type: (text(v, 'type') || 'SECURITY') as GroupType,
  status: text(v, 'status') === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  description: text(v, 'description') || null,
  parentId: text(v, 'parentId') || null,
});

export const groupDialogConfig = (
  mode: FormDialogMode,
  parents: FormFieldOption[],
  save: FormDialogConfig<GroupDetail>['save'],
  group?: GroupDetail
): FormDialogConfig<GroupDetail> => ({
  mode,
  title: { create: 'Create Group', edit: 'Edit Group' },
  subtitle: {
    create: 'Members inherit every role attached to the group.',
    edit: 'Update the group details and save your changes.',
  },
  badge: group?.slug,
  submitText: { create: 'Create Group', edit: 'Save Changes' },
  // A group cannot be its own parent.
  sections: sections(
    parents.filter((p) => p.value !== group?.id),
    group
  ),
  value: toValues(group),
  save,
});
