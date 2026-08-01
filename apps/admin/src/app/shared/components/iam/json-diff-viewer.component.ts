import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * JsonDiffViewerComponent — side-by-side (before/after) diff of two objects.
 * Only renders for rows that differ; added/removed values are color-coded.
 */
@Component({
  selector: 'zcc-json-diff-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
      <div
        class="grid grid-cols-[auto_1fr_1fr] border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        <span></span>
        <span>Before</span>
        <span>After</span>
      </div>

      @if (diffs().length === 0) {
        <p class="px-4 py-6 text-center text-sm text-gray-400">
          No changes recorded.
        </p>
      } @else {
        <div class="divide-y divide-gray-100 dark:divide-white/5">
          @for (diff of diffs(); track diff.key) {
            <div class="grid grid-cols-[auto_1fr_1fr] gap-2 px-4 py-2.5 text-sm">
              <span
                class="flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
                [class]="
                  diff.kind === 'added'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : diff.kind === 'removed'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-gray-500/10 text-gray-500'
                "
              >
                {{ diff.kind === 'added' ? '+' : diff.kind === 'removed' ? '−' : '~' }}
              </span>
              <code
                class="min-w-0 break-words rounded-md bg-gray-100 dark:bg-white/5 px-2 py-1 text-xs text-gray-400"
                [class.line-through]="diff.kind === 'removed'"
              >
                {{ diff.key }}
              </code>
              <code
                class="min-w-0 break-words px-2 py-1 text-xs"
                [class]="
                  diff.kind === 'added'
                    ? 'text-emerald-500'
                    : diff.kind === 'removed'
                      ? 'text-red-400 line-through'
                      : 'text-gray-200'
                "
              >
                {{ diff.kind === 'added' ? diff.after : diff.kind === 'removed' ? diff.before : diff.before }}
              </code>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class JsonDiffViewerComponent {
  readonly before = input<Record<string, unknown> | null>(null);
  readonly after = input<Record<string, unknown> | null>(null);

  readonly diffs = computed(() => {
    const a = this.before() ?? {};
    const b = this.after() ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const rows: Array<{ key: string; kind: 'added' | 'removed' | 'changed'; before: string; after: string }> = [];

    for (const key of keys) {
      const hasA = key in a;
      const hasB = key in b;
      const va = a[key];
      const vb = b[key];

      if (!hasA && hasB) {
        rows.push({ key, kind: 'added', before: '', after: JSON.stringify(vb) });
      } else if (hasA && !hasB) {
        rows.push({ key, kind: 'removed', before: JSON.stringify(va), after: '' });
      } else if (JSON.stringify(va) !== JSON.stringify(vb)) {
        rows.push({
          key,
          kind: 'changed',
          before: JSON.stringify(va),
          after: JSON.stringify(vb),
        });
      }
    }

    return rows;
  });
}
