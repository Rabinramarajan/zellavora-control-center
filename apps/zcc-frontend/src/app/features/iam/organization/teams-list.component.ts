import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { PermissionService } from '@core/rbac/services/permission.service';
import { TeamItem } from '@shared/models/iam-admin.model';
import { createListStore } from '@shared/utils/create-list-store';
import { EmptyStateComponent } from '@shared/components/iam';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_INPUT, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { initials } from '../shared/iam-format';
import { teamFields, toTeamRequest } from './team-form';

@Component({
  selector: 'zcc-teams-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, EmptyStateComponent, PaginationComponent, RouterLink],
  template: `
    <zcc-iam-page-header
      title="Teams"
      icon="pi pi-sitemap"
      description="Cross-functional teams and their members."
    >
      @if (canManage()) {
        <button type="button" [class]="btn.primary" (click)="create()">
          <i class="pi pi-plus text-xs" aria-hidden="true"></i>
          New team
        </button>
      }
    </zcc-iam-page-header>

    <div class="mb-4 sm:max-w-sm">
      <label for="team-search" class="sr-only">Search teams</label>
      <input
        id="team-search"
        type="search"
        placeholder="Search teams…"
        [class]="inputClass + ' min-h-[40px]'"
        [value]="store.q()"
        (input)="onSearch($any($event.target).value)"
      />
    </div>

    @if (store.loading() && !store.hasItems()) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (_ of [1, 2, 3]; track $index) {
          <div class="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load teams"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (t of store.items(); track t.id) {
          <li>
            <a
              [routerLink]="['/iam/organization/teams', t.id]"
              class="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">
                {{ t.name }}
              </h2>
              <p class="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500 dark:text-gray-400">
                {{ t.description || 'No description' }}
              </p>
              <div class="mt-4 flex items-center justify-between">
                <div class="flex -space-x-2" aria-hidden="true">
                  @for (m of t.memberPreview; track m.userId) {
                    @if (m.avatarUrl) {
                      <img
                        [src]="m.avatarUrl"
                        alt=""
                        class="size-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
                      />
                    } @else {
                      <span
                        class="flex size-8 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-semibold text-indigo-500 ring-2 ring-white dark:ring-gray-900"
                        >{{ initialsOf(m.fullName) }}</span
                      >
                    }
                  }
                </div>
                <span class="text-sm tabular-nums text-gray-500 dark:text-gray-400"
                  >{{ t.memberCount }} {{ t.memberCount === 1 ? 'member' : 'members' }}</span
                >
              </div>
            </a>
          </li>
        }
      </ul>
      <app-pagination
        class="px-1 py-3"
        entityLabel="teams"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-sitemap"
        title="No teams"
        [message]="
          store.q()
            ? 'No teams match your search.'
            : 'Create a team to group people who work together.'
        "
      />
    }
  `,
})
export class TeamsListComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly router = inject(Router);

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly initialsOf = initials;
  protected readonly canManage = inject(PermissionService).can('users:manage');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly store = createListStore<TeamItem>({
    initialPageSize: 24,
    loader: (query) => firstValueFrom(this.api.listTeams(query)),
  });

  protected onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(q.trim()), 300);
  }

  protected async create(): Promise<void> {
    await this.dialogs.form({
      title: 'New team',
      submitText: 'Create',
      fields: teamFields(),
      submit: async (v) => {
        const created = await firstValueFrom(this.api.createTeam(toTeamRequest(v)));
        this.feedback.success(`${created.name} created.`);
        void this.router.navigate(['/iam/organization/teams', created.id]);
      },
    });
  }
}
