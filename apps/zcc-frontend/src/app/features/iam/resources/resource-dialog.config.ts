import {
  FormDialogConfig,
  FormDialogValues,
  FormSectionDef,
} from '../../../shared/components/form-dialog';
import { EntityStatus, ResourceDetail, ResourceType } from '../../../shared/models/iam.model';
import { CreateResourceRequest, UpdateResourceRequest } from '../../../core/api/iam.api';
import { ChipTone } from '../../../shared/components/iam';
import { IamDialogsService } from '../shared/iam-dialogs.service';

export const RESOURCE_TYPE_OPTIONS: Array<{ value: ResourceType; label: string }> = [
  { value: 'API', label: 'API' },
  { value: 'FEATURE', label: 'Feature' },
  { value: 'DATA', label: 'Data' },
  { value: 'MENU', label: 'Menu' },
  { value: 'REPORT', label: 'Report' },
  { value: 'INTEGRATION', label: 'Integration' },
];

export const RESOURCE_STATUS_OPTIONS: Array<{ value: EntityStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const TYPE_TONES: Record<ResourceType, ChipTone> = {
  API: 'blue',
  FEATURE: 'green',
  DATA: 'amber',
  MENU: 'purple',
  REPORT: 'gray',
  INTEGRATION: 'rose',
};

export const resourceTypeTone = (type: string): ChipTone =>
  TYPE_TONES[type as ResourceType] ?? 'gray';

export const resourceTypeLabel = (type: string): string =>
  RESOURCE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

export const resourceStatusLabel = (status: string): string =>
  status === 'ACTIVE' ? 'Active' : 'Inactive';

const resourceKeyRegex = {
  regex: /^[a-z][a-z0-9.]*$/,
  message: 'Use lowercase letters, digits and dots (start with a letter).',
};

const toValues = (r?: ResourceDetail): FormDialogValues => ({
  name: r?.name ?? '',
  key: r?.key ?? '',
  type: r?.type ?? 'FEATURE',
  category: r?.category ?? '',
  description: r?.description ?? '',
  parentId: r?.parentId ?? '',
  status: r?.status ?? 'ACTIVE',
});

const text = (v: FormDialogValues, key: string): string =>
  typeof v[key] === 'string' ? (v[key] as string).trim() : '';

/** Maps dialog values to the API create request. */
export const toCreateResourceRequest = (v: FormDialogValues): CreateResourceRequest => ({
  name: text(v, 'name') || '',
  key: text(v, 'key') || '',
  type: (text(v, 'type') || 'FEATURE') as ResourceType,
  category: text(v, 'category') || null,
  description: text(v, 'description') || null,
  parentId: text(v, 'parentId') || null,
  metadata: null,
  actions: [],
});

/** Maps dialog values to the API update request. */
export const toUpdateResourceRequest = (
  v: FormDialogValues,
  current?: ResourceDetail
): UpdateResourceRequest => ({
  name: text(v, 'name') || current?.name || '',
  category: text(v, 'category') || null,
  description: text(v, 'description') || null,
  parentId: (text(v, 'parentId') || current?.parentId) ?? null,
  metadata: current?.metadata ?? null,
});

/** Build the form sections for create/edit. */
export function buildResourceSections(
  parentOptions: Array<{ label: string; value: string }>,
  current?: ResourceDetail
): FormSectionDef[] {
  return [
    {
      title: 'Resource Information',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          minLength: 2,
          maxLength: 120,
          placeholder: 'e.g. Billing Invoices',
          readonly: current?.isSystem === true,
          hint: current?.isSystem ? 'System resources cannot be renamed.' : undefined,
        },
        {
          key: 'key',
          label: 'Key',
          type: 'text',
          required: true,
          minLength: 1,
          maxLength: 80,
          pattern: resourceKeyRegex,
          placeholder: 'e.g. billing.invoices',
          readonly: true,
          hint: 'The key is immutable after creation. Use lowercase dotted notation.',
        },
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: RESOURCE_TYPE_OPTIONS,
          readonly: current?.isSystem === true,
        },
        {
          key: 'category',
          label: 'Category',
          type: 'text',
          maxLength: 60,
          placeholder: 'e.g. Finance',
        },
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 3,
          maxLength: 500,
          span: 2,
          placeholder: 'What this resource represents and who can access it',
        },
        {
          key: 'parentId',
          label: 'Parent Resource',
          type: 'select',
          required: false,
          options: [{ label: 'No parent (top-level)', value: '' }, ...parentOptions],
          placeholder: 'No parent (top-level)',
          hint: 'Optional parent for hierarchical resources.',
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          displayAs: 'status',
          options: RESOURCE_STATUS_OPTIONS,
        },
      ],
    },
  ];
}

/** Load parent resource options for the form. */
export async function loadParentResourceOptions(
  dialogs: IamDialogsService
): Promise<Array<{ label: string; value: string }>> {
  const resources = await dialogs.searchResources('');
  return resources.map((r) => ({ label: `${r.label} (${r.sublabel})`, value: r.id }));
}

/** Create the dialog config for create mode. */
export function createResourceDialogConfig(
  save: FormDialogConfig<ResourceDetail>['save'],
  parentOptions: Array<{ label: string; value: string }>
): FormDialogConfig<ResourceDetail> {
  return {
    mode: 'create',
    title: { create: 'Create Resource' },
    subtitle: { create: 'Define the resource. Each action becomes a permission key.' },
    submitText: { create: 'Create Resource' },
    sections: buildResourceSections(parentOptions),
    value: toValues(),
    save,
  };
}

/** Create the dialog config for edit mode. */
export function editResourceDialogConfig(
  save: FormDialogConfig<ResourceDetail>['save'],
  parentOptions: Array<{ label: string; value: string }>,
  current: ResourceDetail
): FormDialogConfig<ResourceDetail> {
  return {
    mode: 'edit',
    title: { edit: 'Edit Resource' },
    subtitle: { edit: 'Update the resource details and save your changes.' },
    badge: current.key,
    submitText: { edit: 'Save Changes' },
    sections: buildResourceSections(parentOptions, current),
    value: toValues(current),
    save,
  };
}
