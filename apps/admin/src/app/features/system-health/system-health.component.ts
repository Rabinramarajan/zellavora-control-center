import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemHealthRepository } from '@core/repositories/system-health.repository';

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './system-health.component.html',
  styleUrl: './system-health.component.css',
})
export class SystemHealthComponent {
  readonly repository = inject(SystemHealthRepository);

  constructor() {
    this.refreshMetrics();
  }

  refreshMetrics() {
    this.repository.loadHealthMetrics().subscribe();
  }
}
