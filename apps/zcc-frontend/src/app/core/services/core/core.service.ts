import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { inject, Injectable, signal, TemplateRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppDialogService } from '../../../shared/components/dialog';

export type AlertResult = boolean | undefined;

/**
 * Compatibility facade for older callers.
 *
 * New code should inject `AppDialogService` directly. This facade delegates
 * alerts and confirmations to the application's shared standalone dialogs.
 */
@Injectable({ providedIn: 'root' })
export class CoreService {
  private readonly cdkDialog = inject(Dialog);
  private readonly appDialog = inject(AppDialogService);
  private readonly dialogClosedState = signal(false);

  /** True after the most recently opened dialog closes. */
  readonly dialogClosed = this.dialogClosedState.asReadonly();

  /** True whenever at least one application dialog is open. */
  readonly hasOpenDialogs = this.appDialog.hasOpenDialogs;

  /** Opens a custom component or template and resolves with its close result. */
  async openDialog<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>
  ): Promise<R | undefined> {
    this.dialogClosedState.set(false);
    const result = await firstValueFrom(this.cdkDialog.open<R, D, C>(content, config).closed);
    this.dialogClosedState.set(true);
    return result;
  }

  closeDialog(id?: string): void {
    if (id) {
      const ref = this.cdkDialog.getDialogById(id);
      if (!ref) {
        console.warn(`Dialog with ID ${id} not found.`);
        return;
      }
      ref.close();
      return;
    }

    this.appDialog.closeAll();
  }

  async deleteDialog(message: string, type = 'delete'): Promise<AlertResult> {
    this.dialogClosedState.set(false);
    const result = await firstValueFrom(
      this.appDialog.confirm({
        title: this.titleFor(type, 'Confirm deletion'),
        message,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger',
      })
    );
    this.dialogClosedState.set(true);
    return result;
  }

  notificationDialog(message: string): Promise<AlertResult> {
    return this.showAlert('Notification', message);
  }

  errorMessageOnly(message: string): Promise<AlertResult> {
    return this.showAlert('Error', message, 'danger');
  }

  singleErrorMessageOnly(message: string): Promise<AlertResult> {
    return this.showAlert('Error', message, 'danger');
  }

  singleErrorMessageAccLock(message: string): Promise<AlertResult> {
    return this.showAlert('Account locked', message, 'warning');
  }

  private async showAlert(
    title: string,
    message: string,
    variant: 'primary' | 'danger' | 'warning' = 'primary'
  ): Promise<AlertResult> {
    this.dialogClosedState.set(false);
    await firstValueFrom(this.appDialog.alert({ title, message, variant }));
    this.dialogClosedState.set(true);
    return undefined;
  }

  private titleFor(type: string, fallback: string): string {
    const title = type.trim().replace(/[-_]+/g, ' ');
    return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : fallback;
  }
}
