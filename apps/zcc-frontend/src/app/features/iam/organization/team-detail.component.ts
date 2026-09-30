import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { PermissionService } from '@core/rbac/services/permission.service';
import { OrgMember, TeamDetail } from '@shared/models/iam-admin.model';
import { EmptyStateComponent } from '@shared/components/iam';
import { IAM_BTN, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { MembersPanelComponent } from '../shared/members-panel.component';
import { teamFields, toTeamRequest } from './team-form';

@Component({
  selector: 'zcc-team-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, MembersPanelComponent, EmptyStateComponent, RouterLink],
  template: `
    <a
      routerLink="/iam/organization/teams"
      class="mb-4 inline-flex min-h-[36px] items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i> Teams
    </a>

    @if (loading() && !team()) {
      <div class="space-y-3">
        <div class="h-8 w-64 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"></div>
        <div class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
      </div>
    } @else if (loadError()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Team unavailable"
        [message]="loadError()!"
      />
    } @else if (team(); as t) {
      <zcc-iam-page-header
        [title]="t.name"
        icon="pi pi-sitemap"
        [description]="t.description ?? ''"
      >
        @if (canManage()) {
          <button type="button" [class]="btn.secondary" (click)="edit(t)">
            <i class="pi pi-pencil text-xs" aria-hidden="true"></i> Edit
          </button>
          <button type="button" [class]="btn.danger" (click)="remove(t)">
            <i class="pi pi-trash text-xs" aria-hidden="true"></i> Delete
          </button>
        }
      </zcc-iam-page-header>

      <zcc-members-panel
        [members]="t.members"
        [canManage]="canManage()"
        [busyUserId]="busyUserId()"
        emptyMessage="This team has no members yet."
        (add)="addMembers(t)"
        (remove)="removeMember(t, $event)"
      />
    }
  `,
})
export class TeamDetailComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly router = inject(Router);
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' }
  );

  protected readonly btn = IAM_BTN;
  protected readonly canManage = inject(PermissionService).can('users:manage');
  protected readonly team = signal<TeamDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busyUserId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.team.set(await firstValueFrom(this.api.getTeam(id)));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Could not load this team.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(t: TeamDetail): Promise<void> {
    await this.dialogs.form({
      title: `Edit ${t.name}`,
      fields: teamFields(t),
      submit: async (v) => {
        this.team.set(await firstValueFrom(this.api.updateTeam(t.id, toTeamRequest(v))));
        this.feedback.success('Team updated.');
      },
    });
  }

  protected async remove(t: TeamDetail): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Delete team?',
      `${t.name} will be deleted. Members keep their accounts.`,
      'Delete'
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.deleteTeam(t.id));
      this.feedback.success(`${t.name} deleted.`);
      await this.router.navigate(['/iam/organization/teams']);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  protected async addMembers(t: TeamDetail): Promise<void> {
    await this.dialogs.pick({
      title: `Add members to ${t.name}`,
      searchPlaceholder: 'Search users…',
      excludeIds: t.members.map((m) => m.userId),
      search: this.dialogs.searchUsers,
      submit: async (ids) => {
        this.team.set(await firstValueFrom(this.api.addTeamMembers(t.id, ids)));
        this.feedback.success(`${ids.length} member(s) added.`);
      },
    });
  }

  protected async removeMember(t: TeamDetail, m: OrgMember): Promise<void> {
    this.busyUserId.set(m.userId);
    try {
      this.team.set(await firstValueFrom(this.api.removeTeamMember(t.id, m.userId)));
      this.feedback.success(`${m.fullName} removed from ${t.name}.`);
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busyUserId.set(null);
    }
  }
}
