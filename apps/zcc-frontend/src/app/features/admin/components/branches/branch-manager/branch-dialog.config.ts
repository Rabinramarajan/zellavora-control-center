import {
  FormDialogConfig,
  FormDialogMode,
  FormDialogValues,
  FormSectionDef,
} from '../../../../../shared/components/form-dialog';
import { BranchItem, SaveBranchRequest } from '../../../../../shared/models/iam-admin.model';

const sections = (current?: BranchItem): FormSectionDef[] => [
  {
    title: 'Basic Information',
    fields: [
      {
        key: 'name',
        label: 'Branch Name',
        type: 'text',
        required: true,
        minLength: 2,
        maxLength: 120,
        placeholder: 'e.g. Chennai Office',
      },
      {
        key: 'code',
        label: 'Branch Code',
        type: 'text',
        readonly: true,
        hint: current ? undefined : 'Generated automatically when the branch is created.',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        displayAs: 'status',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      {
        key: 'isHeadOffice',
        label: 'Head Office',
        type: 'toggle',
        inlineLabel: 'Head office',
        // Head office moves by promoting another branch, never by clearing it here.
        readonly: current?.isHeadOffice === true,
        hint: current?.isHeadOffice
          ? 'To move it, mark another branch as head office.'
          : 'Only one branch can be the head office.',
      },
    ],
  },
  {
    title: 'Location',
    fields: [
      {
        key: 'address',
        label: 'Street Address',
        type: 'textarea',
        rows: 2,
        maxLength: 300,
        placeholder: 'Building, street, area',
      },
      { key: 'city', label: 'City', type: 'text', maxLength: 100, placeholder: 'Enter city' },
      {
        key: 'state',
        label: 'State / Province',
        type: 'text',
        maxLength: 100,
        placeholder: 'Enter state',
      },
      {
        key: 'country',
        label: 'Country',
        type: 'text',
        maxLength: 100,
        placeholder: 'Enter country',
      },
      {
        key: 'pincode',
        label: 'Postal Code',
        type: 'text',
        maxLength: 12,
        placeholder: 'Enter postal code',
        pattern: { regex: /^[A-Za-z0-9 -]*$/, message: 'Use letters, digits, spaces or -.' },
      },
    ],
  },
  {
    title: 'Contact',
    fields: [
      {
        key: 'phone',
        label: 'Phone Number',
        type: 'tel',
        maxLength: 20,
        placeholder: 'Enter phone number',
      },
      {
        key: 'email',
        label: 'Email Address',
        type: 'email',
        maxLength: 254,
        placeholder: 'Enter email address',
      },
    ],
  },
];

const toValues = (b?: BranchItem): FormDialogValues => ({
  name: b?.name ?? '',
  code: b?.code ?? 'Assigned on save',
  status: b?.status ?? 'active',
  isHeadOffice: b?.isHeadOffice ?? false,
  address: b?.address ?? '',
  city: b?.city ?? '',
  state: b?.state ?? '',
  country: b?.country ?? '',
  pincode: b?.pincode ?? '',
  phone: b?.phone ?? '',
  email: b?.email ?? '',
});

const str = (v: FormDialogValues, key: string): string | null =>
  typeof v[key] === 'string' ? (v[key] as string) : null;

/** Maps dialog values to the API request; read-only fields are already excluded. */
export const toBranchRequest = (v: FormDialogValues): SaveBranchRequest => ({
  name: str(v, 'name') ?? '',
  status: v['status'] === 'inactive' ? 'inactive' : 'active',
  ...('isHeadOffice' in v && { isHeadOffice: v['isHeadOffice'] === true }),
  address: str(v, 'address'),
  city: str(v, 'city'),
  state: str(v, 'state'),
  country: str(v, 'country'),
  pincode: str(v, 'pincode'),
  phone: str(v, 'phone'),
  email: str(v, 'email'),
});

export const branchDialogConfig = (
  mode: FormDialogMode,
  save: FormDialogConfig<BranchItem>['save'],
  branch?: BranchItem,
  canEdit = false
): FormDialogConfig<BranchItem> => ({
  mode,
  title: { create: 'Create Branch', edit: 'Edit Branch', view: 'Branch Details' },
  subtitle: {
    create: 'Add a new branch to your organization.',
    edit: 'Update the branch details and save your changes.',
    view: 'View the branch details.',
  },
  badge: branch?.code ?? undefined,
  submitText: { create: 'Create Branch', edit: 'Save Changes' },
  canEdit,
  sections: sections(branch),
  value: toValues(branch),
  save,
});
