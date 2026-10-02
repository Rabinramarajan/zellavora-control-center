import {
  FormDialogConfig,
  FormDialogMode,
  FormDialogValues,
} from '../../../shared/components/form-dialog';
import { SaveTeamRequest, TeamDetail, TeamItem } from '../../../shared/models/iam-admin.model';

type TeamLike = TeamItem | TeamDetail;

export const toTeamRequest = (v: FormDialogValues): SaveTeamRequest => ({
  name: typeof v['name'] === 'string' ? v['name'] : '',
  description: typeof v['description'] === 'string' ? v['description'] : null,
});

/** Create / edit / view config for the common form dialog. */
export const teamDialogConfig = <R extends TeamLike>(
  mode: FormDialogMode,
  save: FormDialogConfig<R>['save'],
  team?: TeamLike,
  canEdit = false
): FormDialogConfig<R> => ({
  mode,
  title: { create: 'Create Team', edit: 'Edit Team', view: 'Team Details' },
  subtitle: {
    create: 'Group people who work together across departments.',
    edit: 'Update the team details and save your changes.',
    view: 'View the team details.',
  },
  submitText: { create: 'Create Team', edit: 'Save Changes' },
  canEdit,
  value: {
    name: team?.name ?? '',
    description: team?.description ?? '',
    memberCount: team ? String(team.memberCount) : '0',
  },
  sections: [
    {
      title: 'Basic Information',
      fields: [
        {
          key: 'name',
          label: 'Team Name',
          type: 'text',
          required: true,
          minLength: 2,
          maxLength: 120,
          placeholder: 'e.g. Platform Squad',
        },
        {
          key: 'memberCount',
          label: 'Members',
          type: 'text',
          readonly: true,
          hint: team ? undefined : 'Add members from the team page after creating it.',
        },
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 3,
          maxLength: 1000,
          placeholder: 'What does this team work on? (optional)',
        },
      ],
    },
  ],
  save,
});
