import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { TeamItem } from '../../../shared/models/iam-admin.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { EmptyStateComponent } from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
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
  templateUrl: './teams-list.component.html',
  styleUrl: './teams-list.component.scss',
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
