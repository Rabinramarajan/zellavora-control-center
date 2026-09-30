import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrgMember } from '@shared/models/iam-admin.model';
import { StatusChipComponent } from '@shared/components/iam';
import { IAM_BTN, IAM_CARD, IAM_INPUT } from './iam-page-header.component';
import { initials } from './iam-format';

/** Member list with local filtering, used by department and team detail pages. */
@Component({
  selector: 'zcc-members-panel',
  standalone: true,
  imports: [RouterLink, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="card" aria-labelledby="members-heading">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="members-heading" class="text-base font-semibold text-gray-900 dark:text-white">
          Members
          <span class="ml-1 text-sm font-normal text-gray-500 tabular-nums"
            >({{ members().length }})</span
          >
        </h2>
        <div class="flex gap-2">
          @if (members().length > 8) {
            <label class="sr-only" for="member-filter">Filter members</label>
            <input
              id="member-filter"
              type="search"
              placeholder="Filter…"
              [class]="inputClass + ' min-h-[40px] sm:w-56'"
              [value]="filter()"
              (input)="filter.set($any($event.target).value)"
            />
          }
          @if (canManage()) {
            <button type="button" [class]="btn.primary" (click)="add.emit()">
              <i class="pi pi-user-plus text-xs" aria-hidden="true"></i>
              Add members
            </button>
          }
        </div>
      </div>

      @if (!members().length) {
        <p
          class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400"
        >
          {{ emptyMessage() }}
        </p>
      } @else {
        <ul class="divide-y divide-gray-100 dark:divide-white/5">
          @for (m of filtered(); track m.userId) {
            <li class="flex min-h-[56px] items-center gap-3 py-2">
              @if (m.avatarUrl) {
                <img [src]="m.avatarUrl" alt="" class="size-9 shrink-0 rounded-full object-cover" />
              } @else {
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-500"
                  aria-hidden="true"
                >
                  {{ initialsOf(m.fullName) }}
                </span>
              }
              <div class="min-w-0 flex-1">
                <a
                  [routerLink]="['/iam/users', m.userId]"
                  class="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-white"
                  >{{ m.fullName }}</a
                >
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ m.email }}{{ m.jobTitle ? ' · ' + m.jobTitle : '' }}
                </p>
              </div>
              @if (m.status !== 'ACTIVE') {
                <zcc-status-chip [value]="m.status" [label]="m.status" />
              }
              @if (canManage()) {
                <button
                  type="button"
                  [class]="btn.icon + ' hover:!text-red-500'"
                  [attr.aria-label]="'Remove ' + m.fullName"
                  title="Remove"
                  [disabled]="busyUserId() === m.userId"
                  (click)="remove.emit(m)"
                >
                  <i class="pi pi-times" aria-hidden="true"></i>
                </button>
              }
            </li>
          } @empty {
            <li class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No members match “{{ filter() }}”.
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class MembersPanelComponent {
  readonly members = input.required<OrgMember[]>();
  readonly canManage = input(false);
  readonly busyUserId = input<string | null>(null);
  readonly emptyMessage = input('No members yet.');
  readonly add = output<void>();
  readonly remove = output<OrgMember>();

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly initialsOf = initials;
  protected readonly filter = signal('');
  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.members();
    return this.members().filter(
      (m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });
}
