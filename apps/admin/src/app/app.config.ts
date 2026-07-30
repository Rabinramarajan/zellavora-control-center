import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';
import { correlationIdInterceptor } from './core/http/correlation-id.interceptor';
import { loggingInterceptor } from './core/http/logging.interceptor';
import { retryInterceptor } from './core/http/retry.interceptor';
import { errorInterceptor } from './core/error/error.interceptor';
import { PolicyVersionInterceptor } from './core/rbac/interceptors/policy-version.interceptor';
import { ConfigService } from './core/config/config.service';

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
    providePrimeNG({
      theme: {
        preset: Aura
      }
    }),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      return configService.loadConfig();
    }),
  ],
};