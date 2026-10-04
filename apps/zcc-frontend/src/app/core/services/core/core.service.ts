import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { inject, Injectable, TemplateRef } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

import { AlertComponent } from '../../../app-core/core-component/dialog-component.component';
import { DeleteAlertComponent } from '../../../app-core/delete-alert/delete-alert.component';

/** Data handed to the alert components (read it with DIALOG_DATA). */
export interface AlertDialogData {
  msg: string;
  type: string;
}

/** What the alert dialogs resolve with. Adjust if your components close with something else. */
export type AlertResult = boolean | undefined;

@Injectable({ providedIn: 'root' })
export class CoreService {
  private readonly dialog = inject(Dialog);
  private readonly closed$ = new BehaviorSubject<boolean>(false);

  watchOnDialogClosed(): Observable<boolean> {
    return this.closed$.asObservable();
  }

  /** Opens any component or template in a CDK dialog and resolves with its close result. */
  openDialog<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): Promise<R | undefined> {
    return firstValueFrom(this.dialog.open<R, D, C>(content, config).closed);
  }

  closeDialog(id?: string): void {
    if (id) {
      const ref = this.dialog.getDialogById(id);
      if (!ref) {
        console.warn(`Dialog with ID ${id} not found.`);
        return;
      }
      ref.close();
    } else {
      this.dialog.closeAll();
    }
    this.closed$.next(true);
  }

  deleteDialog(message: string, type: string): Promise<AlertResult> {
    return this.showAlert(DeleteAlertComponent, type, message);
  }

  notificationDialog(message: string): Promise<AlertResult> {
    return this.showAlert(AlertComponent, 'notification', message, 'notification-pane');
  }

  errorMessageOnly(message: string): Promise<AlertResult> {
    return this.showAlert(AlertComponent, 'commonError', message, 'Common-pane');
  }

  singleErrorMessageOnly(message: string): Promise<AlertResult> {
    return this.showAlert(AlertComponent, 'singleError', message, 'Common-pane');
  }

  singleErrorMessageAccLock(message: string): Promise<AlertResult> {
    return this.showAlert(AlertComponent, 'accountLock', message, 'Common-pane');
  }

  private async showAlert(
    component: ComponentType<unknown>,
    type: string,
    msg: string,
    panelClass = '',
  ): Promise<AlertResult> {
    const result = await this.openDialog<AlertResult, AlertDialogData>(component, {
      width: '500px',
      disableClose: true,
      panelClass,
      data: { msg, type },
    });

    this.closed$.next(true);
    return result;
  }
}