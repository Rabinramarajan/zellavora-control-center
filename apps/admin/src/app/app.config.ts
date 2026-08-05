import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { switchMap } from 'rxjs/operators';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';
import { correlationIdInterceptor } from './core/http/correlation-id.interceptor';
import { loggingInterceptor } from './core/http/logging.interceptor';
import { retryInterceptor } from './core/http/retry.interceptor';
import { errorInterceptor } from './core/error/error.interceptor';
import { PolicyVersionInterceptor } from './core/rbac/interceptors/policy-version.interceptor';
import { ConfigService } from './core/config/config.service';
import { INPUT_VALIDATION_MESSAGES } from './shared/components/input-control/input-control.types';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withHashLocation()),
    provideHttpClient(
      withInterceptors([
        correlationIdInterceptor,
        apiBaseUrlInterceptor,
        loggingInterceptor,
        authInterceptor,
        retryInterceptor,
        errorInterceptor,
      ]),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: PolicyVersionInterceptor, multi: true },
    {
      provide: INPUT_VALIDATION_MESSAGES,
      useValue: {
        emailTaken: 'This email is already registered.',
        orgNameTaken: 'This organization name is already registered.',
      },
    },
    providePrimeNG(),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      const authService = inject(AuthService);
      // 1. Load the runtime config first (the API base-url interceptor needs it).
      // 2. Then silently restore any existing session from the stored refresh
      //    token so a page refresh keeps the user logged in.
      return configService
        .loadConfig()
        .pipe(switchMap(() => authService.initialize()));
    }),
  ],
};