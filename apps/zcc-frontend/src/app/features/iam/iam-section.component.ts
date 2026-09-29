import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

interface IamSectionData {
  title: string;
  icon: string;
  description: string;
}

/**
 * Landing view for IAM sections whose management screens are not built yet.
 * Title, icon and description come from the route's `data`.
 */
@Component({
  selector: 'zcc-iam-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    @if (section(); as s) {
      <header class="mb-6">
        <h1 class="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
          <i [class]="s.icon" class="text-indigo-500" aria-hidden="true"></i>
          {{ s.title }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ s.description }}</p>
      </header>
      <div
        class="rounded-xl border border-dashed border-gray-300 dark:border-white/15 p-10 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        This section is not available yet.
      </div>
    }
  `,
})
export class IamSectionComponent {
  protected readonly section = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data as IamSectionData)),
  );
}
