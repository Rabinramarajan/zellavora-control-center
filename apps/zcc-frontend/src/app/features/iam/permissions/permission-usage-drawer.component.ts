import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { DialogShellComponent, injectDialogData } from '../../../shared/components/dialog';
import { CatalogPermission, CatalogPermissionDetail } from '../../../shared/models/iam-admin.model';
import { StatusChipComponent } from '../../../shared/components/iam';
import { errorMessage } from '../shared/iam-feedback.service';

/** Side drawer listing the roles that grant or deny a permission. */
@Component({
  selector: 'zcc-permission-usage-drawer',
  standalone: true,
  imports: [DialogShellComponent, StatusChipComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-usage-drawer.component.html',
  styleUrl: './permission-usage-drawer.component.scss',
})
export class PermissionUsageDrawerComponent {
  protected readonly data = injectDialogData<CatalogPermission>();
  protected readonly detail = signal<CatalogPermissionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    firstValueFrom(inject(IamAdminApiService).getPermission(this.data.id))
      .then((d) => this.detail.set(d))
      .catch((err) => this.error.set(errorMessage(err, 'Could not load usage.')))
      .finally(() => this.loading.set(false));
  }
}
