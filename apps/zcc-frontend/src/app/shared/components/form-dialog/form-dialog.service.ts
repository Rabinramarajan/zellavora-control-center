import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppDialogService } from '../dialog';
import { FormDialogComponent } from './form-dialog.component';
import { FormDialogConfig, FormDialogOpenOptions } from './form-dialog.types';

/**
 * Opens the common create / edit / view form dialog.
 *
 *   const saved = await this.formDialog.open({
 *     mode: 'create',
 *     title: { create: 'Create User', edit: 'Edit User', view: 'User Details' },
 *     sections: [{ title: 'Basic Information', fields: [...] }],
 *     save: (values) => firstValueFrom(this.api.create(values)),
 *   });
 *
 * Resolves with `save`'s result, or null when the dialog was dismissed.
 */
@Injectable({ providedIn: 'root' })
export class FormDialogService {
  private readonly dialog = inject(AppDialogService);

  open<R>(config: FormDialogConfig<R>, options: FormDialogOpenOptions = {}): Promise<R | null> {
    const ref = this.dialog.open<FormDialogComponent<R>, FormDialogConfig<R>, R | null>(
      FormDialogComponent,
      // Closing is owned by the dialog so it can confirm before discarding edits.
      { data: config, size: options.size ?? 'lg', disableClose: true }
    );
    return firstValueFrom(ref.closed).then((result) => result ?? null);
  }
}
