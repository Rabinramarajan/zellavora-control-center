import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '@core/rbac';
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
  imports: [FormsModule, ButtonModule, TextareaModule, HasPermissionDirective],
  template: `
    <section
      *hasPermission="'timesheet:approve'"
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <header class="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">Approval</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ subtitle() }}</p>
        </div>
      </header>

      @if (isPending()) {
        <div class="space-y-3">
          <label class="block text-sm font-medium" for="rejection-reason">
            Reason (required to reject)
          </label>
          <textarea
            pTextarea
            id="rejection-reason"
            rows="3"
            class="w-full"
            [(ngModel)]="reason"
            [disabled]="busy()"
            placeholder="Explain what needs to change before this can be approved"
          ></textarea>

          <div class="flex flex-wrap gap-2">
            <p-button
              label="Approve"
              severity="success"
              [disabled]="busy()"
              (onClick)="approve()"
            />
            <p-button
              label="Reject"
              severity="danger"
              [outlined]="true"
              [disabled]="busy() || !reason().trim()"
              (onClick)="reject()"
            />
          </div>
        </div>
      } @else {
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ idleMessage() }}</p>
      }
    </section>
  `,
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
