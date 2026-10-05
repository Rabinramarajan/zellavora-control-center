import { firstValueFrom } from 'rxjs';
import { AppDialogService } from '../../shared/components/dialog';

/**
 * Ask why an approved sheet is being reopened. The server records the reason
 * in the audit log, so it is required. Resolves with `null` when dismissed.
 */
export const askReopenReason = (dialog: AppDialogService, what: string): Promise<string | null> =>
  firstValueFrom(
    dialog.prompt({
      title: `Reopen ${what}?`,
      message:
        'It goes back to draft so you can change it, and must be finalized again afterwards.',
      label: 'Reason',
      placeholder: 'e.g. Wrong hours on Friday',
      required: true,
      confirmText: 'Reopen',
      variant: 'warning',
    })
  );
