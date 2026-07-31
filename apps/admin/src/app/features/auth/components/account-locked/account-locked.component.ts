import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-account-locked',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './account-locked.component.html',
  styleUrls: ['../../auth-shell.css', './account-locked.component.css'],
})
export class AccountLockedComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  countdown = signal<number>(0);
  lockReason = signal<string>('Too many failed login attempts');
  attemptsCount = signal<number>(5);
  private timerInterval: any;

  ngOnInit() {
    const reason = this.route.snapshot.queryParamMap.get('reason') || 'Too many failed login attempts';
    const lockTime = this.route.snapshot.queryParamMap.get('lockTime');
    this.lockReason.set(reason);
    // Default: 15 minute lock
    const lockDuration = lockTime ? parseInt(lockTime) : 900;
    this.countdown.set(lockDuration);
    this.timerInterval = setInterval(() => {
      if (this.countdown() > 0) this.countdown.update(t => t - 1);
      else {
        clearInterval(this.timerInterval);
        // Auto redirect to login when lock expires
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }

  ngOnDestroy() { clearInterval(this.timerInterval); }

  get countdownFormatted(): string {
    const m = Math.floor(this.countdown() / 60);
    const s = this.countdown() % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  get progressPct(): number {
    return (1 - this.countdown() / 900) * 100;
  }

  /** SVG ring circumference for a circle of r=54 */
  readonly ringCircumference = 2 * Math.PI * 54; // ≈ 339.29

  get ringDashoffset(): number {
    const pct = this.countdown() / 900; // 1 = full, 0 = empty
    return this.ringCircumference * (1 - pct);
  }

  goToLogin() { this.router.navigate(['/auth/login']); }
}
