import { inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

/** Typed access to the data passed through `AppDialogService.open()`. */
export function injectDialogData<D>(): D {
  return inject<D>(DIALOG_DATA);
}

/** Typed access to the current dialog's ref. `R` = the result you close with. */
export function injectDialogRef<R = unknown, C = unknown>(): DialogRef<R, C> {
  return inject<DialogRef<R, C>>(DialogRef);
}
