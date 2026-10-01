import { SaveTeamRequest, TeamDetail } from '../../../shared/models/iam-admin.model';
import { FormField, FormValues } from '../shared/iam-form-dialog.component';

export const teamFields = (current?: TeamDetail): FormField[] => [
  {
    key: 'name',
    label: 'Name',
    type: 'text',
    required: true,
    maxLength: 120,
    value: current?.name,
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    maxLength: 1000,
    value: current?.description,
  },
];

export const toTeamRequest = (v: FormValues): SaveTeamRequest => ({
  name: String(v['name']),
  description: (v['description'] as string) || null,
});
