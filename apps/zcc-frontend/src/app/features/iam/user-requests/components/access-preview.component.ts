import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AccessPreview } from '../../../../shared/models/user-request.model';

/**
 * Current-vs-requested access comparison plus the calculated permissions the
 * user will hold (role → permissions → resources). Differences are highlighted.
 */
@Component({
  selector: 'zcc-access-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (preview(); as p) {
      @if (p.privileged) {
        <div
          role="note"
          class="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
        >
          <i class="pi pi-shield mt-0.5" aria-hidden="true"></i>
          Privileged access requested — a Security Approval step is added to the workflow.
        </div>
      }

      <h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
        {{ showCurrent() ? 'Current vs Requested Access' : 'Requested Access' }}
      </h3>
      <div class="mb-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table class="w-full min-w-[480px] text-sm">
          <thead>
            <tr
              class="border-b border-gray-200 bg-gray-50/80 text-left dark:border-white/10 dark:bg-white/5"
            >
              <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                Access
              </th>
              @if (showCurrent()) {
                <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                  Current
                </th>
              }
              <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                Requested
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-white/5">
            @for (row of p.comparison; track row.key) {
              <tr [class.bg-indigo-500/5]="row.changed && showCurrent()">
                <th
                  scope="row"
                  class="px-4 py-2.5 text-left font-medium text-gray-700 dark:text-gray-200"
                >
                  {{ row.label }}
                  @if (row.changed && showCurrent()) {
                    <span
                      class="ml-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-300"
                    >
                      Changed
                    </span>
                  }
                </th>
                @if (showCurrent()) {
                  <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ row.current }}</td>
                }
                <td
                  class="px-4 py-2.5"
                  [class]="
                    row.changed && showCurrent()
                      ? 'font-semibold text-indigo-600 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-300'
                  "
                >
                  {{ row.requested }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          Effective Permissions ({{ visiblePermissions().length }})
        </h3>
        @if (showCurrent() && changedCount()) {
          <label
            class="inline-flex min-h-[36px] items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
          >
            <input
              type="checkbox"
              class="size-4 rounded border-gray-300 text-indigo-500"
              [checked]="onlyChanges()"
              (change)="onlyChanges.set(!onlyChanges())"
            />
            Only show differences ({{ changedCount() }})
          </label>
        }
      </div>
      @if (visiblePermissions().length) {
        <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table class="w-full min-w-[640px] text-sm">
            <thead>
              <tr
                class="border-b border-gray-200 bg-gray-50/80 text-left dark:border-white/10 dark:bg-white/5"
              >
                <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                  Resource
                </th>
                <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                  Permission
                </th>
                <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                  Source
                </th>
                <th scope="col" class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
                  Scope
                </th>
                @if (showCurrent()) {
                  <th
                    scope="col"
                    class="px-4 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300"
                  >
                    Current
                  </th>
                }
                <th
                  scope="col"
                  class="px-4 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300"
                >
                  Requested
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-white/5">
              @for (perm of visiblePermissions(); track perm.key) {
                <tr [class.bg-indigo-500/5]="perm.changed && showCurrent()">
                  <td class="px-4 py-2.5 capitalize text-gray-700 dark:text-gray-200">
                    {{ perm.resource }}
                  </td>
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-xs text-gray-700 dark:text-gray-200">{{
                      perm.key
                    }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ perm.source }}</td>
                  <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ perm.scope }}</td>
                  @if (showCurrent()) {
                    <td class="px-4 py-2.5 text-center">
                      <span [attr.aria-label]="perm.current ? 'Granted' : 'Not granted'">
                        {{ perm.current ? '✓' : '—' }}
                      </span>
                    </td>
                  }
                  <td
                    class="px-4 py-2.5 text-center"
                    [class]="
                      perm.changed && showCurrent()
                        ? perm.requested
                          ? 'font-bold text-emerald-500'
                          : 'font-bold text-red-500'
                        : ''
                    "
                  >
                    <span [attr.aria-label]="perm.requested ? 'Granted' : 'Not granted'">
                      {{ perm.requested ? '✓' : '—' }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p
          class="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-white/10"
        >
          No permissions are granted by the selected roles and groups.
        </p>
      }
    }
  `,
})
export class AccessPreviewComponent {
  readonly preview = input<AccessPreview | null>(null);
  /** False for new users, who have no current access to compare against. */
  readonly showCurrent = input(true);

  protected readonly onlyChanges = signal(false);
  protected readonly changedCount = computed(
    () => this.preview()?.permissions.filter((p) => p.changed).length ?? 0
  );
  protected readonly visiblePermissions = computed(() => {
    const perms = this.preview()?.permissions ?? [];
    const relevant = this.showCurrent() ? perms : perms.filter((p) => p.requested);
    return this.onlyChanges() ? relevant.filter((p) => p.changed) : relevant;
  });
}
