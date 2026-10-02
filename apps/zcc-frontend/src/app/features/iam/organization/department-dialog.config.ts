import {
  FormDialogConfig,
  FormDialogMode,
  FormDialogValues,
  FormFieldOption,
} from '../../../shared/components/form-dialog';
import { DepartmentItem, SaveDepartmentRequest } from '../../../shared/models/iam-admin.model';

const toValues = (d?: DepartmentItem): FormDialogValues => ({
  name: d?.name ?? '',
  code: d?.code ?? '',
  parentId: d?.parentId ?? null,
  status: d?.status ?? 'active',
  description: d?.description ?? '',
});

const str = (v: FormDialogValues, key: string): string | null =>
  typeof v[key] === 'string' ? (v[key] as string) : null;

export const toDepartmentRequest = (v: FormDialogValues): SaveDepartmentRequest => ({
  name: str(v, 'name') ?? '',
  code: str(v, 'code'),
  parentId: str(v, 'parentId'),
  description: str(v, 'description'),
  status: v['status'] === 'inactive' ? 'inactive' : 'active',
});

/**
 * Create / edit / view config for the common form dialog.
 * `parents` must already exclude the department being edited.
 */
export const departmentDialogConfig = (
  mode: FormDialogMode,
  parents: readonly FormFieldOption[],
  save: FormDialogConfig<DepartmentItem>['save'],
  department?: DepartmentItem,
  canEdit = false
): FormDialogConfig<DepartmentItem> => ({
  mode,
  title: { create: 'Create Department', edit: 'Edit Department', view: 'Department Details' },
  subtitle: {
    create: 'Add a department to organise people in your organization.',
    edit: 'Update the department details and save your changes.',
    view: 'View the department details.',
  },
  badge: department?.code ?? undefined,
  submitText: { create: 'Create Department', edit: 'Save Changes' },
  canEdit,
  value: toValues(department),
  sections: [
    {
      title: 'Basic Information',
      fields: [
        {
          key: 'name',
          label: 'Department Name',
          type: 'text',
          required: true,
          minLength: 2,
          maxLength: 120,
          placeholder: 'e.g. Engineering',
        },
        {
          key: 'code',
          label: 'Department Code',
          type: 'text',
          maxLength: 20,
          placeholder: 'e.g. ENG',
          hint: 'Optional short code. Letters, digits, - and _ only.',
          pattern: { regex: /^[A-Za-z0-9_-]*$/, message: 'Use letters, digits, - and _ only.' },
        },
        {
          key: 'parentId',
          label: 'Parent Department',
          type: 'select',
          placeholder: 'None (top level)',
          options: parents,
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
      ],
    },
    {
      title: 'Additional Information',
      fields: [
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 3,
          maxLength: 500,
          placeholder: 'Enter description (optional)',
        },
      ],
    },
  ],
  save,
});
