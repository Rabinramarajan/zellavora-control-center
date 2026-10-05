import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '../../../../core/rbac';
import { TimesheetService } from '../../data/timesheet.service';
import { formatPeriod } from '../../data/timesheet.model';

/**
 * Manager-only approval controls.
 *
 * `*hasPermission` hides the panel from anyone without `timesheet:approve`;
 * the backend enforces the same permission on the approve and reject routes,
 * so hiding it here is a convenience, not the control.
 */
@Component({
  selector: 'app-timesheet-approval-panel',
  standalone: true,
  imports: [FormsModule, TextareaModule, HasPermissionDirective],
  templateUrl: './timesheet-approval-panel.component.html',
  styleUrl: './timesheet-approval-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetApprovalPanelComponent {
  private readonly service = inject(TimesheetService);

  protected readonly reason = signal('');
  protected readonly busy = signal(false);

  protected readonly isPending = computed(() => this.service.status() === 'SUBMITTED');

  protected readonly subtitle = computed(() => {
    const sheet = this.service.timesheet();
    if (!sheet) return '';
    return `${sheet.user.fullName} — ${formatPeriod(sheet.period)} — ${sheet.totalHours} h`;
  });

  protected readonly idleMessage = computed(() => {
    const sheet = this.service.timesheet();
    switch (sheet?.status) {
      case 'APPROVED':
        return `Approved${sheet.approver ? ` by ${sheet.approver.fullName}` : ''}.`;
      case 'REJECTED':
        return `Rejected — ${sheet.rejectionReason ?? 'no reason recorded'}. Waiting on the employee.`;
      default:
        return 'Nothing to review: this timesheet has not been submitted yet.';
    }
  });

  protected async approve(): Promise<void> {
    this.busy.set(true);
    try {
      await this.service.approve();
      this.reason.set('');
    } finally {
      this.busy.set(false);
    }
  }

  protected async reject(): Promise<void> {
    const reason = this.reason().trim();
    if (!reason) return;
    this.busy.set(true);
    try {
      await this.service.reject(reason);
      this.reason.set('');
    } finally {
      this.busy.set(false);
    }
  }
}
