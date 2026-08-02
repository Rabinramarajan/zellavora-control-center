import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

export interface ActiveSession {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  country: string;
  lastLogin: string;
  loginTime: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-session-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-management.component.html',
  styleUrls: ['../../auth-shell.css', './session-management.component.css'],
})
export class SessionManagementComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  sessions = signal<ActiveSession[]>([]);
  isLoading = signal<boolean>(false);
  isRevoking = signal<string | null>(null);
  isRevokingAll = signal<boolean>(false);
  errorMsg = signal<string>('');
  successMsg = signal<string>('');

  ngOnInit() {
    this.loadSessions();
  }

  async loadSessions() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const res = await firstValueFrom(this.auth.getSessions());
      this.sessions.set(res?.sessions || []);
    } catch (e: any) {
      this.errorMsg.set('Failed to load sessions. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async revokeSession(sessionId: string) {
    this.isRevoking.set(sessionId);
    this.errorMsg.set('');
    try {
      await firstValueFrom(this.auth.revokeSession(sessionId));
      this.sessions.update(sessions => sessions.filter(s => s.id !== sessionId));
      this.successMsg.set('Session revoked successfully.');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      this.errorMsg.set('Failed to revoke session.');
    } finally {
      this.isRevoking.set(null);
    }
  }

  async revokeAllSessions() {
    this.isRevokingAll.set(true);
    this.errorMsg.set('');
    try {
      await firstValueFrom(this.auth.revokeAllSessions());
      this.successMsg.set('All other sessions have been revoked.');
      this.sessions.update(sessions => sessions.filter(s => s.isCurrent));
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      this.errorMsg.set('Failed to revoke all sessions.');
    } finally {
      this.isRevokingAll.set(false);
    }
  }

  getBrowserIcon(browser: string): string {
    const b = browser.toLowerCase();
    if (b.includes('chrome')) return '🌐';
    if (b.includes('firefox')) return '🦊';
    if (b.includes('safari')) return '🧭';
    if (b.includes('edge')) return '🔵';
    return '🌐';
  }

  getOsIcon(os: string): string {
    const o = os.toLowerCase();
    if (o.includes('windows')) return '🪟';
    if (o.includes('mac')) return '🍎';
    if (o.includes('linux')) return '🐧';
    if (o.includes('android')) return '🤖';
    if (o.includes('ios') || o.includes('iphone')) return '📱';
    return '💻';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(dateStr));
    } catch { return dateStr; }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  async logoutCurrentAndAll() {
    await firstValueFrom(this.auth.logoutAll());
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
