import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AccessPreview } from '../../../../shared/models/user-request.model';

/**
 * Current-vs-requested access comparison plus the calculated permissions the
 * user will hold (role → permissions → resources). Differences are highlighted.
 */
@Component({
  selector: 'zcc-access-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-preview.component.html',
  styleUrl: './access-preview.component.scss',
})
export class AccessPreviewComponent {
  readonly preview = input<AccessPreview | null>(null);
  /** False for new users, who have no current access to compare against. */
  readonly showCurrent = input(true);

  protected readonly onlyChanges = signal(false);
  protected readonly changedCount = computed(
    () => this.preview()?.permissions.filter((p) => p.changed).length ?? 0
  );
  protected readonly visiblePermissions = computed(() => {
    const perms = this.preview()?.permissions ?? [];
    const relevant = this.showCurrent() ? perms : perms.filter((p) => p.requested);
    return this.onlyChanges() ? relevant.filter((p) => p.changed) : relevant;
  });
}
