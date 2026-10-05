import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { bindBreadcrumbLabel } from '../../../core/services/breadcrumb';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { GroupDetail } from '../../../shared/models/iam.model';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import { FormDialogService, FormFieldOption } from '../../../shared/components/form-dialog';
import { IAM_BTN } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { formatDate } from '../shared/iam-format';
import {
  groupDialogConfig,
  groupTypeTone,
  groupStatusLabel,
  groupTypeLabel,
  toGroupRequest,
} from './group-dialog.config';

type SectionKey = 'details' | 'members' | 'roles' | 'children';

const PARENT_PAGE_SIZE = 100;

@Component({
  selector: 'zcc-groups-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, EmptyStateComponent, StatusChipComponent],
  templateUrl: './groups-detail.component.html',
  styleUrl: './groups-detail.component.scss',
})
export class GroupsDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);
  private readonly formDialog = inject(FormDialogService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canManage = inject(PermissionService).can('groups:manage');

  private readonly groupId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly btn = IAM_BTN;
  protected readonly date = formatDate;
  protected readonly typeLabel = groupTypeLabel;
  protected readonly statusLabel = groupStatusLabel;
  protected readonly typeTone = groupTypeTone;

  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly collapsed = signal<ReadonlySet<SectionKey>>(new Set());

  public constructor() {
    bindBreadcrumbLabel(() => this.group()?.name);
    // Re-runs when navigating between groups (e.g. parent / child links).
    effect(() => {
      const id = this.groupId();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.group.set(null);
    this.loadError.set(null);
    try {
      this.group.set(unwrap(await firstValueFrom(this.api.getGroup(id))));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Group not found.'));
    }
  }

  protected reload(): void {
    const id = this.groupId();
    if (id) void this.load(id);
  }

  protected isOpen(key: SectionKey): boolean {
    return !this.collapsed().has(key);
  }

  protected toggle(key: SectionKey): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Group
  // ---------------------------------------------------------------------------

  protected async edit(): Promise<void> {
    const current = this.group()!;
    const saved = await this.formDialog.open(
      groupDialogConfig(
        'edit',
        await this.parentOptions(),
        (values) =>
          firstValueFrom(this.api.updateGroup(current.id, toGroupRequest(values, current))).then(
            unwrap
          ),
        current
      )
    );
    if (saved) {
      this.group.set(saved);
      this.feedback.success('Group updated.');
    }
  }

  protected async remove(): Promise<void> {
    const g = this.group()!;
    const ok = await this.dialogs.confirm(
      `Delete ${g.name}?`,
      'Its members lose every role granted through this group. This cannot be undone.',
      'Delete',
      true
    );
    if (!ok) return;
    await this.run(async () => {
      await firstValueFrom(this.api.deleteGroup(g.id));
      this.feedback.success('Group deleted.');
      await this.router.navigate(['/iam/groups']);
    });
  }

  // ---------------------------------------------------------------------------
  // Members & roles
  // ---------------------------------------------------------------------------

  protected async addMembers(): Promise<void> {
    const g = this.group()!;
    await this.dialogs.pick({
      title: `Add members to ${g.name}`,
      description: 'Members inherit every role attached to this group.',
      confirmText: 'Add Members',
      searchPlaceholder: 'Search users…',
      excludeIds: g.members.map((m) => m.userId),
      search: this.dialogs.searchUsers,
      submit: async (userIds) => {
        this.group.set(unwrap(await firstValueFrom(this.api.addGroupMembers(g.id, userIds))));
        this.feedback.success(`${userIds.length} member(s) added.`);
      },
    });
  }

  protected async removeMember(userId: string, name: string): Promise<void> {
    const ok = await this.dialogs.confirm(
      `Remove ${name}?`,
      'They lose every role granted through this group.',
      'Remove',
      true
    );
    if (!ok) return;
    await this.run(async () => {
      this.group.set(
        unwrap(await firstValueFrom(this.api.removeGroupMember(this.group()!.id, userId)))
      );
      this.feedback.success('Member removed.');
    });
  }

  protected async addRoles(): Promise<void> {
    const g = this.group()!;
    await this.dialogs.pick({
      title: `Attach roles to ${g.name}`,
      description: 'Every member of the group receives these roles.',
      confirmText: 'Attach Roles',
      searchPlaceholder: 'Search roles…',
      excludeIds: g.roles.map((r) => r.roleId),
      search: this.dialogs.searchRoles,
      submit: async (roleIds) => {
        this.group.set(
          unwrap(await firstValueFrom(this.api.setGroupRoles(g.id, { roleIds, mode: 'merge' })))
        );
        this.feedback.success(`${roleIds.length} role(s) attached.`);
      },
    });
  }

  protected async removeRole(roleId: string, name: string): Promise<void> {
    const ok = await this.dialogs.confirm(
      `Detach ${name}?`,
      'Members lose this role unless they receive it another way.',
      'Detach',
      true
    );
    if (!ok) return;
    const g = this.group()!;
    const roleIds = g.roles.filter((r) => r.roleId !== roleId).map((r) => r.roleId);
    await this.run(async () => {
      this.group.set(
        unwrap(await firstValueFrom(this.api.setGroupRoles(g.id, { roleIds, mode: 'replace' })))
      );
      this.feedback.success('Role detached.');
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** User account statuses (ACTIVE, LOCKED, PENDING, ...) as title case. */
  protected memberStatus(status: string): string {
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  private async parentOptions(): Promise<FormFieldOption[]> {
    try {
      const page = unwrap(
        await firstValueFrom(
          this.api.listGroups({ page: 1, pageSize: PARENT_PAGE_SIZE, sort: 'name', order: 'asc' })
        )
      );
      return page.data.map((g) => ({ value: g.id, label: g.name }));
    } catch {
      return [];
    }
  }
}
