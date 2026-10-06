import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AppSettingsService } from '../services/app-settings/app-settings.service';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // Pass through fully qualified URLs and static assets unchanged
  if (
    req.url.startsWith('http://') ||
    req.url.startsWith('https://') ||
    req.url.startsWith('/assets/')
  ) {
    return next(req);
  }

  const { applicationPath, adminPath, supabaseFunctions } =
    inject(AppSettingsService).environment;

  const appBase = applicationPath.replace(/\/+$/, '');
  const adminBase = adminPath.replace(/\/+$/, '');
  const legacyBase = supabaseFunctions.replace(/\/+$/, '');

  let url = req.url;

  if (url.startsWith('/api/app/') || url === '/api/app') {
    // New canonical application path: /api/app/* → applicationPath/*
    url = appBase + url.slice('/api/app'.length);
  } else if (url.startsWith('/api/admin/') || url === '/api/admin') {
    // New canonical admin path: /api/admin/* → adminPath/*
    url = adminBase + url.slice('/api/admin'.length);
  } else if (url.startsWith('/api/v1')) {
    // Legacy path — forward to application base for backward compatibility
    url = legacyBase + url.slice('/api/v1'.length);
  } else {
    url = legacyBase + url;
  }

  return next(req.clone({ url }));
};
