import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType, Overlay, PositionStrategy } from '@angular/cdk/overlay';
import { Observable, map, merge } from 'rxjs';

import {
  APP_DIALOG_TITLE_ID,
  AppDialogConfig,
  ConfirmDialogData,
  PromptDialogData,
  DialogPosition,
  DialogSize,
} from './dialog.types';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { PromptDialogComponent } from './prompt-dialog.component';

const SIZE_WIDTH: Record<DialogSize, string> = {
  sm: '400px',
  md: '560px',
  lg: '800px',
  xl: '1140px',
  full: '100vw',
};

interface Dimensions {
  width: string;
  height?: string;
  maxWidth: string;
  maxHeight: string;
}

const toArray = (v?: string | string[]): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

@Injectable({ providedIn: 'root' })
export class AppDialogService {
  readonly #dialog = inject(Dialog);
  readonly #overlay = inject(Overlay);
  #nextId = 0;

  /** True while at least one dialog is open (handy for disabling shortcuts, etc.). */
  readonly hasOpenDialogs = toSignal(
    merge(
      this.#dialog.afterOpened.pipe(map(() => true)),
      this.#dialog.afterAllClosed.pipe(map(() => false))
    ),
    { initialValue: false }
  );

  /**
   * Opens any component as a dialog.
   * @typeParam C component, D data, R result passed to `ref.close(result)`
   */
  open<C, D = unknown, R = unknown>(
    component: ComponentType<C>,
    config: AppDialogConfig<D> = {}
  ): DialogRef<R, C> {
    const size = config.size ?? 'md';
    const position = config.position ?? 'center';
    const titleId = `app-dialog-title-${this.#nextId++}`;

    return this.#dialog.open<R, D, C>(component, {
      data: config.data,
      ...this.#dimensions(size, position, config),
      positionStrategy: this.#positionStrategy(size, position),
      hasBackdrop: config.hasBackdrop ?? true,
      disableClose: config.disableClose ?? false,
      panelClass: [
        'app-dialog-panel',
        `app-dialog-panel--${size}`,
        `app-dialog-panel--${position}`,
        ...toArray(config.panelClass),
      ],
      backdropClass: ['app-dialog-backdrop', ...toArray(config.backdropClass)],
      ariaLabel: config.ariaLabel ?? null,
      ariaLabelledBy: config.ariaLabel ? null : titleId,
      autoFocus: config.autoFocus ?? 'first-tabbable',
      restoreFocus: config.restoreFocus ?? true,
      closeOnNavigation: config.closeOnNavigation ?? true,
      providers: [{ provide: APP_DIALOG_TITLE_ID, useValue: titleId }],
    });
  }

  /** Emits `true` on confirm, `false` on cancel / Escape / backdrop. */
  confirm(
    data: ConfirmDialogData,
    config: Omit<AppDialogConfig, 'data'> = {}
  ): Observable<boolean> {
    return this.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      size: 'sm',
      ...config,
      data,
    }).closed.pipe(map((result) => result === true));
  }

  /** Single-button informational dialog. Emits once when dismissed. */
  alert(
    data: Omit<ConfirmDialogData, 'cancelText' | 'hideCancel'>,
    config: Omit<AppDialogConfig, 'data'> = {}
  ): Observable<void> {
    return this.confirm({ confirmText: 'OK', ...data, hideCancel: true }, config).pipe(
      map(() => undefined)
    );
  }

  /** Single-field text input. Emits the trimmed value, or `null` when dismissed. */
  prompt(
    data: PromptDialogData,
    config: Omit<AppDialogConfig, 'data'> = {}
  ): Observable<string | null> {
    return this.open<PromptDialogComponent, PromptDialogData, string | null>(
      PromptDialogComponent,
      {
        size: 'sm',
        ...config,
        data,
      }
    ).closed.pipe(map((result) => result ?? null));
  }

  closeAll(): void {
    this.#dialog.closeAll();
  }

  #dimensions(size: DialogSize, position: DialogPosition, c: AppDialogConfig): Dimensions {
    const width = c.width ?? SIZE_WIDTH[size];

    if (size === 'full') {
      return { width: '100vw', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh' };
    }

    switch (position) {
      case 'left':
      case 'right':
        return { width, height: c.height ?? '100dvh', maxWidth: '100vw', maxHeight: '100dvh' };
      case 'bottom':
        return { width, height: c.height, maxWidth: '100vw', maxHeight: c.maxHeight ?? '85dvh' };
      default:
        return {
          width,
          height: c.height,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: c.maxHeight ?? 'calc(100dvh - 32px)',
        };
    }
  }

  #positionStrategy(size: DialogSize, position: DialogPosition): PositionStrategy {
    const global = this.#overlay.position().global();
    if (size === 'full') return global.top('0').left('0');

    switch (position) {
      case 'right':
        return global.top('0').right('0');
      case 'left':
        return global.top('0').left('0');
      case 'bottom':
        return global.bottom('0').centerHorizontally();
      default:
        return global.centerHorizontally().centerVertically();
    }
  }
}
