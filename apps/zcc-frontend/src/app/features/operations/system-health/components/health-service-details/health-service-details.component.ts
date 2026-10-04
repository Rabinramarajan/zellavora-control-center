import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ServiceHealthResult } from '../../system-health.models';

@Component({
  selector: 'zcc-health-service-details',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-service-details.component.html',
})
export class HealthServiceDetailsComponent {
  readonly service: ServiceHealthResult = inject(DIALOG_DATA);
  readonly dialogRef = inject(DialogRef);

  close() {
    this.dialogRef.close();
  }
}
