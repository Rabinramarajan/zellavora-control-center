import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '../../../core/api/iam.api';
import { GroupDetail } from '../../../shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { AppDialogService } from '../../../shared/components/dialog';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';

@Component({
  selector: 'zcc-groups-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, DetailTabsComponent, StatusChipComponent, EmptyStateComponent],
  templateUrl: './groups-detail.component.html',
  styleUrl: './groups-detail.component.scss',
})
export class GroupsDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  readonly group = signal<GroupDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('members');

  readonly tabs = (): DetailTab[] => [
    { key: 'members', label: 'Members', icon: 'pi pi-users' },
    { key: 'roles', label: 'Roles', icon: 'pi pi-shield' },
    { key: 'children', label: 'Children', icon: 'pi pi-sitemap' },
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
  ];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getGroup(id));
      this.group.set(res.data);
    } catch {
      this.group.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  initials(name: string | null): string {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  async onAddMember(): Promise<void> {
    const g = this.group()!;
    await this.dialogs.pick({
      title: `Add members to ${g.name}`,
      description: 'Members inherit every role attached to this group.',
      searchPlaceholder: 'Search users…',
      excludeIds: g.members.map((m) => m.userId),
      search: this.dialogs.searchUsers,
      submit: async (userIds) => {
        const res = await firstValueFrom(this.api.addGroupMembers(g.id, userIds));
        this.group.set(res.data);
        this.feedback.success(`${userIds.length} member(s) added.`);
      },
    });
  }

  async onRemoveMember(userId: string): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Remove member?',
        message: 'This member will lose every role granted through this group.',
        confirmText: 'Remove',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      const res = await firstValueFrom(this.api.removeGroupMember(this.group()!.id, userId));
      this.group.set(res.data);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  async onAddRole(): Promise<void> {
    const g = this.group()!;
    await this.dialogs.pick({
      title: `Attach roles to ${g.name}`,
      searchPlaceholder: 'Search roles…',
      excludeIds: g.roles.map((r) => r.roleId),
      search: this.dialogs.searchRoles,
      submit: async (roleIds) => {
        const res = await firstValueFrom(this.api.setGroupRoles(g.id, { roleIds, mode: 'merge' }));
        this.group.set(res.data);
        this.feedback.success(`${roleIds.length} role(s) attached.`);
      },
    });
  }

  async onRemoveRole(roleId: string): Promise<void> {
    const current = this.group()!;
    const next = current.roles.filter((r) => r.roleId !== roleId).map((r) => r.roleId);
    try {
      const res = await firstValueFrom(
        this.api.setGroupRoles(current.id, { roleIds: next, mode: 'replace' })
      );
      this.group.set(res.data);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  async onDelete(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete group?',
        message: 'This will remove the group, its memberships and attached roles.',
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteGroup(this.group()!.id));
      await this.router.navigate(['/iam/groups']);
    } catch (err) {
      this.feedback.error(err);
    }
  }
}
