import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { bindBreadcrumbLabel } from '../../../core/services/breadcrumb';
import { ResourceAction, ResourceDetail } from '../../../shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { AppDialogService } from '../../../shared/components/dialog';
import { FormDialogService } from '../../../shared/components/form-dialog';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { IAM_BTN } from '../shared/iam-page-header.component';
import {
  editResourceDialogConfig,
  toUpdateResourceRequest,
  loadParentResourceOptions,
} from './resource-dialog.config';

@Component({
  selector: 'zcc-resources-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, DetailTabsComponent, StatusChipComponent, EmptyStateComponent],
  templateUrl: './resources-detail.component.html',
  styleUrl: './resources-detail.component.scss',
})
export class ResourcesDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly formDialog = inject(FormDialogService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly resource = signal<ResourceDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly activeTab = signal('overview');

  protected readonly btn = IAM_BTN;

  protected readonly tabs = (): DetailTab[] => [
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
    { key: 'actions', label: 'Actions', icon: 'pi pi-key' },
  ];

  constructor() {
    bindBreadcrumbLabel(() => this.resource()?.name);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getResource(id));
      this.resource.set(res.data);
    } catch {
      this.resource.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(): Promise<void> {
    const current = this.resource()!;
    const parentOptions = await loadParentResourceOptions(this.dialogs);
    const saved = await this.formDialog.open(
      editResourceDialogConfig(
        (values) =>
          firstValueFrom(
            this.api.updateResource(current.id, toUpdateResourceRequest(values, current))
          ).then(unwrap),
        parentOptions,
        current
      )
    );
    if (saved) {
      this.resource.set(saved);
      this.feedback.success('Resource updated.');
    }
  }

  async onAddAction(): Promise<void> {
    const name = await firstValueFrom(
      this.dialog.prompt({
        title: 'Add action',
        label: 'Action name',
        placeholder: 'lowercase, e.g. approve',
        required: true,
        confirmText: 'Add',
      })
    );
    if (!name) return;
    try {
      await firstValueFrom(
        this.api.addResourceAction(this.resource()!.id, { action: name.trim() })
      );
      await this.load();
    } catch {
      /* surface via store later */
    }
  }

  async onRemoveAction(action: ResourceAction): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Remove action?',
        message: `Remove action '${action.action}'? Its permission key will be deleted.`,
        confirmText: 'Remove',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.removeResourceAction(this.resource()!.id, action.id));
      await this.load();
    } catch {
      /* ignore */
    }
  }

  async onDelete(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete resource?',
        message:
          'This will remove the resource and its mapped permissions. This action cannot be undone.',
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteResource(this.resource()!.id));
      this.feedback.success('Resource deleted.');
      await this.router.navigate(['/iam/resources']);
    } catch {
      /* ignore */
    }
  }
}
