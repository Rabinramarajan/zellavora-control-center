import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { OrgMember, TeamDetail } from '../../../shared/models/iam-admin.model';
import { EmptyStateComponent } from '../../../shared/components/iam';
import { IAM_BTN, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { MembersPanelComponent } from '../shared/members-panel.component';
import { FormDialogService } from '../../../shared/components/form-dialog';
import { teamDialogConfig, toTeamRequest } from './team-dialog.config';

@Component({
  selector: 'zcc-team-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, MembersPanelComponent, EmptyStateComponent, RouterLink],
  templateUrl: './team-detail.component.html',
  styleUrl: './team-detail.component.scss',
})
export class TeamDetailComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly formDialog = inject(FormDialogService);
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
    const saved = await this.formDialog.open(
      teamDialogConfig<TeamDetail>(
        'edit',
        async (values) => {
          const updated = await firstValueFrom(this.api.updateTeam(t.id, toTeamRequest(values)));
          this.team.set(updated);
          return updated;
        },
        t
      )
    );
    if (saved) this.feedback.success('Team updated.');
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
