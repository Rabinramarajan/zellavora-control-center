import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

/** Consistent empty-state illustration used across dashboard widgets. */
@Component({
  selector: 'app-dashboard-empty',
  standalone: true,
  imports: [],
  template: `
    <div class="flex flex-col items-center justify-center py-10 text-center px-4">
      <div
        class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-3"
        aria-hidden="true"
      >
        {{ icon() }}
      </div>
      <h4 class="text-sm font-bold text-white">{{ title() }}</h4>
      <p class="text-xs text-slate-400 mt-1 max-w-xs">{{ message() }}</p>
      @if (actionLabel()) {
        <button
          (click)="actionClicked.emit()"
          class="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardEmptyComponent {
  readonly icon = input<string>('📭');
  readonly title = input<string>('Nothing here yet');
  readonly message = input<string>('');
  readonly actionLabel = input<string>('');
  readonly actionClicked = output<void>();
}

/** Consistent error state with retry action. */
@Component({
  selector: 'app-dashboard-error',
  standalone: true,
  imports: [],
  template: `
    <div class="flex flex-col items-center justify-center py-10 text-center px-4">
      <div
        class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mb-3"
        aria-hidden="true"
      >
        ⚠️
      </div>
      <h4 class="text-sm font-bold text-white">Something went wrong</h4>
      <p class="text-xs text-slate-400 mt-1 max-w-sm">{{ message() }}</p>
      <button
        (click)="retryClicked.emit()"
        class="mt-4 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-colors"
      >
        Retry
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardErrorComponent {
  readonly message = input<string>('Unable to load this section.');
  readonly retryClicked = output<void>();
}
