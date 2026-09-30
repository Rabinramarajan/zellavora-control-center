import { InjectionToken } from '@angular/core';
import { AutoFocusTarget } from '@angular/cdk/dialog';

/** Preset widths. `full` = full-screen. */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** Where the dialog is anchored. `right` / `left` = side drawer, `bottom` = bottom sheet. */
export type DialogPosition = 'center' | 'right' | 'left' | 'bottom';

export type DialogVariant = 'primary' | 'danger' | 'warning';

export interface AppDialogConfig<D = unknown> {
  data?: D;
  size?: DialogSize;
  position?: DialogPosition;
  /** Overrides the preset width from `size`. */
  width?: string;
  height?: string;
  maxHeight?: string;
  /** Blocks Escape and backdrop-click closing. */
  disableClose?: boolean;
  hasBackdrop?: boolean;
  panelClass?: string | string[];
  backdropClass?: string | string[];
  /**
   * Use when your component does NOT use <app-dialog-shell> (the shell wires
   * aria-labelledby to its title automatically).
   */
  ariaLabel?: string;
  autoFocus?: AutoFocusTarget | string | boolean;
  restoreFocus?: boolean;
  closeOnNavigation?: boolean;
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  /** Hides the cancel button — turns the confirm dialog into an alert. */
  hideCancel?: boolean;
}

export interface PromptDialogData {
  title: string;
  message?: string;
  /** Visible input label; falls back to the title. */
  label?: string;
  placeholder?: string;
  initialValue?: string;
  inputType?: 'text' | 'email' | 'number';
  /** Disables submit while the trimmed value is empty. Defaults to off. */
  required?: boolean;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

/** Id of the shell's title element; the service points aria-labelledby at it. */
export const APP_DIALOG_TITLE_ID = new InjectionToken<string>('APP_DIALOG_TITLE_ID');
