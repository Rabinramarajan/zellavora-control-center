import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { RoleDetail } from '../../../shared/models/iam.model';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import { FormDialogService } from '../../../shared/components/form-dialog';
import { IAM_BTN } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { formatDate } from '../shared/iam-format';
import { groupTypeLabel, groupTypeTone } from '../groups/group-dialog.config';
import { PermissionMatrixComponent, PermissionRow } from './permission-matrix.component';
import {
  copyRoleDialogConfig,
  roleDialogConfig,
  roleScopeLabel,
  roleStatusLabel,
  toCopyRequest,
  toRoleRequest,
} from './role-dialog.config';

type SectionKey = 'details' | 'permissions' | 'groups' | 'users';

@Component({
  selector: 'zcc-roles-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    EmptyStateComponent,
    StatusChipComponent,
    PermissionMatrixComponent,
  ],
  templateUrl: './roles-detail.component.html',
  styleUrl: './roles-detail.component.scss',
})
export class RolesDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);
  private readonly formDialog = inject(FormDialogService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canManage = inject(PermissionService).can('roles:manage');

  private readonly roleId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly btn = IAM_BTN;
  protected readonly date = formatDate;
  protected readonly scopeLabel = roleScopeLabel;
  protected readonly statusLabel = roleStatusLabel;
  protected readonly groupTypeLabel = groupTypeLabel;
  protected readonly groupTypeTone = groupTypeTone;

  protected readonly role = signal<RoleDetail | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly collapsed = signal<ReadonlySet<SectionKey>>(new Set());

  protected readonly matrix = signal<PermissionRow[]>([]);
  protected readonly matrixDirty = signal(false);
  /** Bumped to rebuild the matrix from the saved permissions (discard / after save). */
  protected readonly matrixVersion = signal(0);
  protected readonly grantedCount = computed(
    () => this.matrix().filter((r) => r.effect !== null).length
  );
  /** System roles may gain permissions but never lose them (the API only merges). */
  protected readonly lockedPermissions = computed<ReadonlySet<string>>(() => {
    const r = this.role();
    return new Set(r?.isSystem ? r.permissions.map((p) => p.permissionId) : []);
  });

  public constructor() {
    // Re-runs when navigating between roles.
    effect(() => {
      const id = this.roleId();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.role.set(null);
    this.loadError.set(null);
    try {
      this.role.set(unwrap(await firstValueFrom(this.api.getRole(id))));
      this.resetMatrix();
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Role not found.'));
    }
  }

  protected async reload(): Promise<void> {
    if (this.matrixDirty() && !(await this.confirmDiscard())) return;
    const id = this.roleId();
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
  // Role
  // ---------------------------------------------------------------------------

  protected async edit(): Promise<void> {
    const current = this.role()!;
    const saved = await this.formDialog.open(
      roleDialogConfig(
        'edit',
        (values) =>
          firstValueFrom(this.api.updateRole(current.id, toRoleRequest(values, current))).then(
            unwrap
          ),
        current
      )
    );
    if (saved) {
      this.role.set(saved);
      this.feedback.success('Role updated.');
    }
  }

  protected async copy(): Promise<void> {
    const source = this.role()!;
    const created = await this.formDialog.open(
      copyRoleDialogConfig(source, (values) =>
        firstValueFrom(this.api.copyRole(source.id, toCopyRequest(values))).then(unwrap)
      )
    );
    if (created) {
      this.feedback.success(`${created.name} created.`);
      await this.router.navigate(['/iam/roles', created.id]);
    }
  }

  protected async remove(): Promise<void> {
    const r = this.role()!;
    const holders = r.userCount + r.groupCount;
    const ok = await this.dialogs.confirm(
      `Delete ${r.name}?`,
      holders
        ? `It is revoked from ${r.userCount} user(s) and ${r.groupCount} group(s). This cannot be undone.`
        : 'This cannot be undone.',
      'Delete',
      true
    );
    if (!ok) return;
    await this.run(async () => {
      await firstValueFrom(this.api.deleteRole(r.id));
      this.feedback.success('Role deleted.');
      await this.router.navigate(['/iam/roles']);
    });
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  protected async savePermissions(): Promise<void> {
    const r = this.role()!;
    const permissions = this.matrix()
      .filter((row) => row.effect !== null)
      .map((row) => ({ permissionId: row.permissionId, effect: row.effect! }));
    await this.run(async () => {
      await firstValueFrom(
        this.api.setRolePermissions(r.id, {
          permissions,
          mode: r.isSystem ? 'merge' : 'replace',
        })
      );
      this.role.set(unwrap(await firstValueFrom(this.api.getRole(r.id))));
      this.resetMatrix();
      this.feedback.success('Permissions saved.');
    });
  }

  protected async discardPermissions(): Promise<void> {
    if (await this.confirmDiscard()) this.resetMatrix();
  }

  private resetMatrix(): void {
    this.matrix.set([]);
    this.matrixDirty.set(false);
    this.matrixVersion.update((v) => v + 1);
  }

  private confirmDiscard(): Promise<boolean> {
    return this.dialogs.confirm(
      'Discard permission changes?',
      'Your unsaved permission changes will be lost.',
      'Discard',
      true
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** User account statuses (ACTIVE, LOCKED, PENDING, ...) as title case. */
  protected accountStatus(status: string): string {
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
}
