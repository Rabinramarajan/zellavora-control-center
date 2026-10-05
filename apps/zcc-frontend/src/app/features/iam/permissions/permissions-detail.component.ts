import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { bindBreadcrumbLabel } from '../../../core/services/breadcrumb';
import { CatalogPermissionDetail } from '../../../shared/models/iam-admin.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { AppDialogService } from '../../../shared/components/dialog';
import { IamFeedbackService } from '../shared/iam-feedback.service';

@Component({
  selector: 'zcc-permissions-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, DetailTabsComponent, StatusChipComponent, EmptyStateComponent, DatePipe],
  templateUrl: './permissions-detail.component.html',
  styleUrl: './permissions-detail.component.scss',
})
export class PermissionsDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamAdminApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly feedback = inject(IamFeedbackService);

  readonly permission = signal<CatalogPermissionDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('overview');

  readonly tabs = (): DetailTab[] => [
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
    { key: 'roles', label: 'Roles', icon: 'pi pi-shield' },
  ];

  constructor() {
    bindBreadcrumbLabel(() => this.permission()?.name);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getPermission(id));
      this.permission.set(res);
    } catch {
      this.permission.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async onEdit(): Promise<void> {
    const p = this.permission();
    if (!p) return;

    const result = await firstValueFrom(
      this.dialog.prompt({
        title: `Edit ${p.key}`,
        label: 'Description',
        placeholder: 'Permission description',
        required: false,
        initialValue: p.description ?? '',
        confirmText: 'Save',
      })
    );

    if (!result) return;

    try {
      await firstValueFrom(this.api.updatePermission(p.id, { description: result.trim() || null }));
      this.feedback.success('Permission updated.');
      await this.load();
    } catch (err) {
      this.feedback.error(err);
    }
  }

  async onDelete(): Promise<void> {
    const p = this.permission()!;
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete permission?',
        message: `${p.key} will be removed from the catalog. This action cannot be undone.`,
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;

    try {
      await firstValueFrom(this.api.deletePermission(p.id));
      this.feedback.success(`${p.key} deleted.`);
      await this.router.navigate(['/iam/permissions']);
    } catch (err) {
      this.feedback.error(err);
    }
  }
}