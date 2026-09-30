import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { PermissionService } from '@core/rbac/services/permission.service';
import { DepartmentDetail, OrgMember } from '@shared/models/iam-admin.model';
import { EmptyStateComponent, StatusChipComponent } from '@shared/components/iam';
import { IAM_BTN, IAM_CARD, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { MembersPanelComponent } from '../shared/members-panel.component';
import { formatDate } from '../shared/iam-format';
import { departmentFields, toDepartmentRequest } from './department-form';

@Component({
  selector: 'zcc-department-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IamPageHeaderComponent,
    MembersPanelComponent,
    StatusChipComponent,
    EmptyStateComponent,
    RouterLink,
  ],
  template: `
    <a
      routerLink="/iam/organization/departments"
      class="mb-4 inline-flex min-h-[36px] items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i> Departments
    </a>

    @if (loading() && !dept()) {
      <div class="space-y-3">
        <div class="h-8 w-64 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"></div>
        <div class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
      </div>
    } @else if (loadError()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Department unavailable"
        [message]="loadError()!"
      />
    } @else if (dept(); as d) {
      <zcc-iam-page-header
        [title]="d.name"
        icon="pi pi-briefcase"
        [description]="d.description ?? ''"
      >
        @if (canManage()) {
          <button type="button" [class]="btn.secondary" (click)="edit(d)">
            <i class="pi pi-pencil text-xs" aria-hidden="true"></i> Edit
          </button>
          <button type="button" [class]="btn.danger" (click)="remove(d)">
            <i class="pi pi-trash text-xs" aria-hidden="true"></i> Delete
          </button>
        }
      </zcc-iam-page-header>

      <dl [class]="card + ' mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4'">
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-500">Status</dt>
          <dd class="mt-1">
            <zcc-status-chip
              [value]="d.status"
              [label]="d.status === 'active' ? 'Active' : 'Inactive'"
            />
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-500">Code</dt>
          <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-white">{{ d.code ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-500">Parent</dt>
          <dd class="mt-1 text-sm">
            @if (d.parentId) {
              <a
                [routerLink]="['/iam/organization/departments', d.parentId]"
                class="text-indigo-600 hover:underline dark:text-indigo-400"
                >{{ d.parentName }}</a
              >
            } @else {
              <span class="text-gray-900 dark:text-white">Top level</span>
            }
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-500">Created</dt>
          <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ date(d.createdAt) }}</dd>
        </div>
      </dl>

      <zcc-members-panel
        [members]="d.members"
        [canManage]="canManage()"
        [busyUserId]="busyUserId()"
        emptyMessage="No one is assigned to this department yet."
        (add)="addMembers(d)"
        (remove)="removeMember(d, $event)"
      />
    }
  `,
})
export class DepartmentDetailComponent {
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' }
  );

  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly router = inject(Router);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly date = formatDate;
  protected readonly canManage = inject(PermissionService).can('users:manage');
  protected readonly dept = signal<DepartmentDetail | null>(null);
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
      this.dept.set(await firstValueFrom(this.api.getDepartment(id)));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Could not load this department.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(d: DepartmentDetail): Promise<void> {
    let parents: Array<{ label: string; value: string }> = [];
    try {
      const all = await firstValueFrom(this.api.listDepartments({ page: 1, pageSize: 200 }));
      parents = all.data.filter((p) => p.id !== d.id).map((p) => ({ label: p.name, value: p.id }));
    } catch (err) {
      this.feedback.error(err, 'Could not load departments.');
    }
    await this.dialogs.form({
      title: `Edit ${d.name}`,
      fields: departmentFields(parents, d),
      submit: async (v) => {
        this.dept.set(
          await firstValueFrom(this.api.updateDepartment(d.id, toDepartmentRequest(v)))
        );
        this.feedback.success('Department updated.');
      },
    });
  }

  protected async remove(d: DepartmentDetail): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Delete department?',
      `${d.name} will be deleted and its ${d.members.length} member(s) unassigned.`,
      'Delete'
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.deleteDepartment(d.id));
      this.feedback.success(`${d.name} deleted.`);
      await this.router.navigate(['/iam/organization/departments']);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  protected async addMembers(d: DepartmentDetail): Promise<void> {
    await this.dialogs.pick({
      title: `Add members to ${d.name}`,
      description: 'People already in another department will be moved here.',
      searchPlaceholder: 'Search users…',
      excludeIds: d.members.map((m) => m.userId),
      search: this.dialogs.searchUsers,
      submit: async (ids) => {
        this.dept.set(await firstValueFrom(this.api.addDepartmentMembers(d.id, ids)));
        this.feedback.success(`${ids.length} member(s) added.`);
      },
    });
  }

  protected async removeMember(d: DepartmentDetail, m: OrgMember): Promise<void> {
    this.busyUserId.set(m.userId);
    try {
      this.dept.set(await firstValueFrom(this.api.removeDepartmentMember(d.id, m.userId)));
      this.feedback.success(`${m.fullName} removed from ${d.name}.`);
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busyUserId.set(null);
    }
  }
}
