import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AuditDetail } from '../../audit-log.models';
import { AuditLogService } from '../../audit-log.service';

@Component({
  selector: 'zcc-audit-details',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-details.component.html',
})
export class AuditDetailsComponent {
  readonly auditId: string = inject(DIALOG_DATA);
  readonly dialogRef = inject(DialogRef);
  private readonly auditService = inject(AuditLogService);

  readonly detail = signal<AuditDetail | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadDetail();
  }

  loadDetail() {
    this.loading.set(true);
    this.error.set(null);

    this.auditService.getById(this.auditId).subscribe({
      next: (data) => {
        this.detail.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message || 'Unable to load audit details.');
      },
    });
  }

  close() {
    this.dialogRef.close();
  }
}
