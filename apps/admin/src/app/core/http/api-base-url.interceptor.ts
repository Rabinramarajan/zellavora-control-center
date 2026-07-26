import { HttpInterceptorFn } from '@angular/common/http';

const API_BASE_URL = 'http://localhost:3000';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // Only prepend base URL to relative URLs (not external URLs)
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    const urlWithBase = API_BASE_URL + req.url;
    req = req.clone({ url: urlWithBase });
  }

  return next(req);
};
