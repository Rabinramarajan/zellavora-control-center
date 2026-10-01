import { DepartmentItem, SaveDepartmentRequest } from '../../../shared/models/iam-admin.model';
import { FormField, FormFieldOption, FormValues } from '../shared/iam-form-dialog.component';

/** Create/edit form for a department; `parents` excludes the department being edited. */
export const departmentFields = (
  parents: FormFieldOption[],
  current?: DepartmentItem
): FormField[] => [
  {
    key: 'name',
    label: 'Name',
    type: 'text',
    required: true,
    maxLength: 120,
    value: current?.name,
  },
  {
    key: 'code',
    label: 'Code',
    type: 'text',
    maxLength: 20,
    value: current?.code,
    placeholder: 'e.g. ENG',
    pattern: { regex: /^[A-Za-z0-9_-]*$/, message: 'Letters, digits, - and _ only.' },
  },
  {
    key: 'parentId',
    label: 'Parent department',
    type: 'select',
    options: parents,
    placeholder: 'None (top level)',
    value: current?.parentId,
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    maxLength: 500,
    value: current?.description,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    value: current?.status ?? 'active',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ],
  },
];

export const toDepartmentRequest = (v: FormValues): SaveDepartmentRequest => ({
  name: String(v['name']),
  code: (v['code'] as string) || null,
  parentId: (v['parentId'] as string) || null,
  description: (v['description'] as string) || null,
  status: v['status'] === 'inactive' ? 'inactive' : 'active',
});
