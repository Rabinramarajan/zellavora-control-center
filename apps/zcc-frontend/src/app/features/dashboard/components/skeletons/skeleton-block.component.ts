import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Animated skeleton block used while dashboard data is loading. */
@Component({
  selector: 'app-skeleton-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="rounded-xl skeleton-pulse"
      [ngClass]="className()"
      [style.height]="height()"
      [attr.aria-hidden]="'true'"
    ></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonBlockComponent {
  readonly height = input<string>('16px');
  readonly className = input<string>('');
}

/** Card-shaped skeleton for KPI / widget placeholders. */
@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  imports: [SkeletonBlockComponent],
  template: `
    <div class="glass-panel p-5 rounded-2xl space-y-3" aria-hidden="true">
      <div class="flex justify-between items-start gap-3">
        <div class="flex-1 space-y-2">
          <app-skeleton-block height="12px" className="w-1/2" />
          <app-skeleton-block height="24px" className="w-3/4" />
          <app-skeleton-block height="10px" className="w-1/3" />
        </div>
        <app-skeleton-block height="40px" className="w-10 rounded-xl shrink-0" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonCardComponent {}
