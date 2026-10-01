import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Safe explanation for a locked or disabled account. Deliberately omits
 * thresholds and exact unlock times.
 */
@Component({
  selector: 'app-account-locked-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-locked.page.html',
  styleUrl: './account-locked.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLockedPage {
  private readonly route = inject(ActivatedRoute);

  protected readonly disabled = computed(
    () => this.route.snapshot.queryParamMap.get('reason') === 'disabled'
  );
  protected readonly supportEmail = toSignal(
    inject(AuthService)
      .config()
      .pipe(
        map((c) => c.supportEmail),
        catchError(() => of('support@zellavora.com'))
      ),
    { initialValue: 'support@zellavora.com' }
  );
}
