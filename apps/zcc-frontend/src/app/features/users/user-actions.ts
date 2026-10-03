import { RequestChangeType } from '../../shared/models/user-admin.model';

export type { RequestChangeType };

export interface ActionMeta {
  label: string;
  icon: string;
}

/** Labels for the Request Change menu; each opens a prefilled User Request. */
export const REQUEST_CHANGE_META: Record<RequestChangeType, ActionMeta> = {
  UPDATE_USER: { label: 'Update User Details', icon: 'pi pi-user-edit' },
  ADD_ROLE: { label: 'Add Role', icon: 'pi pi-plus-circle' },
  REMOVE_ROLE: { label: 'Remove Role', icon: 'pi pi-minus-circle' },
  ADD_GROUP: { label: 'Add Group', icon: 'pi pi-users' },
  REMOVE_GROUP: { label: 'Remove Group', icon: 'pi pi-user-minus' },
  TRANSFER: { label: 'Branch / Team Transfer', icon: 'pi pi-arrow-right-arrow-left' },
  ACTIVATE_USER: { label: 'Activate Account', icon: 'pi pi-check-circle' },
  DEACTIVATE_USER: { label: 'Deactivate Account', icon: 'pi pi-ban' },
  UNLOCK_ACCOUNT: { label: 'Unlock Account', icon: 'pi pi-lock-open' },
  RESET_MFA: { label: 'Reset MFA', icon: 'pi pi-shield' },
};
