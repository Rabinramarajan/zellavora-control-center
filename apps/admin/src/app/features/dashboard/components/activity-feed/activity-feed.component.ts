import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityEvent, AuditSeverity } from '../../dashboard.models';

const ICONS: Record<AuditSeverity, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  critical: '🚨',
};

const TONES: Record<AuditSeverity, string> = {
  debug: 'bg-slate-500/10 text-slate-400',
  info: 'bg-blue-500/10 text-blue-400',
  warning: 'bg-amber-500/10 text-amber-400',
  error: 'bg-red-500/10 text-red-400',
  critical: 'bg-rose-500/10 text-rose-400',
};

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4" role="list">
      @for (event of events(); track event.id) {
        <div class="flex gap-3" role="listitem">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs"
            [ngClass]="toneClass(event.severity)"
            [attr.aria-hidden]="'true'"
          >
            {{ iconFor(event.severity) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] text-slate-300 font-medium leading-normal break-words">
              <span class="text-slate-500 font-mono">{{ event.action }}</span>
              @if (event.resource) {
                <span class="text-slate-500"> · {{ event.resource }}</span>
              }
            </p>
            <span class="text-[9px] text-slate-500 block mt-0.5">
              {{ event.actorEmail ?? 'system' }} · {{ relativeTime(event.createdAt) }}
            </span>
          </div>
        </div>
      } @empty {
        <p class="text-[11px] text-slate-500 text-center py-4">No recent activity.</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFeedComponent {
  readonly events = input<ActivityEvent[]>([]);

  readonly openFeed = output<void>();

  iconFor(severity: AuditSeverity): string {
    return ICONS[severity] ?? 'ℹ️';
  }

  toneClass(severity: AuditSeverity): string {
    return TONES[severity] ?? TONES.info;
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
