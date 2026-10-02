import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { AppDialogService } from '../../../shared/components/dialog';
import { FormDialogMode, FormDialogService } from '../../../shared/components/form-dialog';
import { EmptyStateComponent } from '../../../shared/components/iam';
import {
  ColumnDef,
  FilterState,
  SmartCellDirective,
  SmartTableComponent,
} from '../../../shared/components/smart-table';
import { TeamDetail, TeamItem } from '../../../shared/models/iam-admin.model';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { initials } from '../shared/iam-format';
import { teamDialogConfig, toTeamRequest } from './team-dialog.config';

/** The teams API caps pageSize at 100; load every page so filtering stays client-side. */
const LOAD_PAGE_SIZE = 100;

@Component({
  selector: 'zcc-teams-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'filterOpen.set(false)',
  },
  imports: [DatePipe, RouterLink, SmartTableComponent, SmartCellDirective, EmptyStateComponent],
  templateUrl: './teams-list.component.html',
  styleUrl: './teams-list.component.scss',
})
export class TeamsListComponent implements OnInit {
  private readonly api = inject(IamAdminApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly formDialog = inject(FormDialogService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly canManage = inject(PermissionService).can('users:manage');
  readonly initialsOf = initials;

  readonly teams = signal<TeamItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly filters = signal<FilterState>({ membership: '' });
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50, 100] as const;

  readonly trackBy = (t: TeamItem) => t.id;

  readonly columns: ColumnDef<TeamItem>[] = [
    { key: 'name', header: 'Team', sortable: true, width: '24%' },
    { key: 'description', header: 'Description', value: (t) => t.description ?? '' },
    { key: 'memberCount', header: 'Members', sortable: true, width: '12rem' },
    // Hidden: only drives the membership filter.
    {
      key: 'membership',
      header: 'Membership',
      hidden: true,
      exportable: false,
      value: (t) => (t.memberCount > 0 ? 'with' : 'empty'),
    },
    { key: 'updatedAt', header: 'Last Updated', sortable: true, width: '9rem' },
    { key: 'actions', header: '', align: 'right', width: '8.5rem', exportable: false },
  ];

  readonly membershipOptions = [
    { value: '', label: 'All' },
    { value: 'with', label: 'With members' },
    { value: 'empty', label: 'Empty' },
  ] as const;

  readonly filterOpen = signal(false);
  readonly draftMembership = signal('');
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((value) => value !== '').length
  );

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const all: TeamItem[] = [];
      for (let page = 1, totalPages = 1; page <= totalPages; page++) {
        const result = await firstValueFrom(
          this.api.listTeams({ page, pageSize: LOAD_PAGE_SIZE })
        );
        all.push(...result.data);
        totalPages = result.meta.totalPages;
      }
      this.teams.set(all);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load teams.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onCreate(): Promise<void> {
    if (await this.openDialog('create')) {
      this.feedback.success('Team created.');
      await this.load();
    }
  }

  async onView(t: TeamItem): Promise<void> {
    if (await this.openDialog('view', t)) {
      this.feedback.success('Team updated.');
      await this.load();
    }
  }

  async onEdit(t: TeamItem): Promise<void> {
    if (await this.openDialog('edit', t)) {
      this.feedback.success('Team updated.');
      await this.load();
    }
  }

  async onDelete(t: TeamItem): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete team?',
        message: t.memberCount
          ? `${t.name} has ${t.memberCount} member(s). They keep their accounts but leave this team. This cannot be undone.`
          : `${t.name} will be deleted. This cannot be undone.`,
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteTeam(t.id));
      this.feedback.success(`${t.name} deleted.`);
      await this.load();
    } catch (err) {
      this.feedback.error(err, 'Could not delete the team.');
    }
  }

  toggleFilter(): void {
    if (!this.filterOpen()) this.draftMembership.set(this.filters()['membership'] ?? '');
    this.filterOpen.update((open) => !open);
  }

  applyFilter(): void {
    this.filters.update((filters) => ({ ...filters, membership: this.draftMembership() }));
    this.filterOpen.set(false);
  }

  resetFilter(): void {
    this.draftMembership.set('');
    this.filters.set({ membership: '' });
    this.filterOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.filterOpen()) return;
    const popupRoot = this.host.nativeElement.querySelector('[toolbar-end]');
    if (popupRoot && !popupRoot.contains(event.target as Node)) this.filterOpen.set(false);
  }

  /** Resolves true when the team was saved, false when the dialog was dismissed. */
  private async openDialog(mode: FormDialogMode, team?: TeamItem): Promise<boolean> {
    const config = teamDialogConfig<TeamDetail>(
      mode,
      (values, action) =>
        firstValueFrom(
          action === 'edit' && team
            ? this.api.updateTeam(team.id, toTeamRequest(values))
            : this.api.createTeam(toTeamRequest(values))
        ),
      team,
      this.canManage()
    );
    return (await this.formDialog.open(config)) !== null;
  }
}
