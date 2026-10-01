import { Injectable, inject } from '@angular/core';
import { ErrorBus } from '../../../core/error/error-bus';

/** Message from a normalized HTTP error (see error.interceptor) or any thrown value. */
export const errorMessage = (err: unknown, fallback = 'Something went wrong.'): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

/**
 * Toasts for IAM actions. The global error interceptor only toasts 403/5xx/network
 * failures, so 4xx business errors (409 conflicts, 400 validation) surface here.
 */
@Injectable({ providedIn: 'root' })
export class IamFeedbackService {
  private readonly bus = inject(ErrorBus);

  success(message: string): void {
    this.bus.push({ kind: 'info', message, ttl: 3500 });
  }

  error(err: unknown, fallback?: string): void {
    const status = (err as { status?: number } | null)?.status ?? 0;
    // These are already toasted by the error interceptor.
    if (status === 401 || status === 403 || status === 0 || status >= 500) return;
    this.bus.push({ kind: 'error', message: errorMessage(err, fallback) });
  }
}
