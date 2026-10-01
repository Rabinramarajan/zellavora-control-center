import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * JsonDiffViewerComponent — side-by-side (before/after) diff of two objects.
 * Only renders for rows that differ; added/removed values are color-coded.
 */
@Component({
  selector: 'zcc-json-diff-viewer',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './json-diff-viewer.component.html',
  styleUrl: './json-diff-viewer.component.scss',
})
export class JsonDiffViewerComponent {
  readonly before = input<Record<string, unknown> | null>(null);
  readonly after = input<Record<string, unknown> | null>(null);

  readonly diffs = computed(() => {
    const a = this.before() ?? {};
    const b = this.after() ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const rows: Array<{
      key: string;
      kind: 'added' | 'removed' | 'changed';
      before: string;
      after: string;
    }> = [];

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
