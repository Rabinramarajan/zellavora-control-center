/**
 * authInitializer — APP_INITIALIZER that boots the auth state.
 *
 * On app start:
 *   1. Wait for AuthService.initialize() to attempt a silent refresh.
 *   2. If success: the store is hydrated, the router proceeds to the
 *      protected route (or the original redirect).
 *   3. If failure: store is reset, router proceeds to /auth/login.
 *
 * This is the ONLY way to bridge the gap between "page reload" and "logged in".
 */
import { inject, provideAppInitializer } from '@angular/core';
import { AuthService } from './auth.service';
import { SessionActivityService } from './session-activity.service';
import { firstValueFrom } from 'rxjs';

export const provideAuthInitializer = () =>
  provideAppInitializer(async () => {
    const auth = inject(AuthService);
    const activity = inject(SessionActivityService);
    await firstValueFrom(auth.initialize());
    if (auth) {
      // Re-start idle tracking now that the store is in its final state.
      // (initialize() will have reset() the store if no session, so
      //  start() short-circuits via the isAuthenticated check inside onActivity.)
      activity.start();
    }
  });
