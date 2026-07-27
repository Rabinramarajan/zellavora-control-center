import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ConfigService } from '../config/config.service';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // Do not intercept static asset requests or fully qualified URLs
  if (
    req.url.startsWith('http://') ||
    req.url.startsWith('https://') ||
    req.url.startsWith('/assets/')
  ) {
    return next(req);
  }

  const configService = inject(ConfigService);
  const supabaseFunctionsUrl =
    configService.get('apiUrls.supabaseFunctions') || 'http://localhost:54321/functions/v1';
  const adminApiUrl =
    configService.get('apiUrls.adminApi') || 'http://localhost:3000';

  let rewrittenUrl = req.url;

  const isAdminRequest = 
    rewrittenUrl.startsWith('/api/v1/admin') ||
    rewrittenUrl.startsWith('/api/user') ||
    rewrittenUrl.startsWith('/api/role') ||
    rewrittenUrl.startsWith('/api/resource') ||
    rewrittenUrl.startsWith('/api/Branch') ||
    rewrittenUrl.startsWith('/api/MAsterConfig') ||
    rewrittenUrl.startsWith('/api/auditlog') ||
    rewrittenUrl.startsWith('/api/config') ||
    rewrittenUrl.startsWith('/api/group') ||
    rewrittenUrl.startsWith('/user') ||
    rewrittenUrl.startsWith('/role') ||
    rewrittenUrl.startsWith('/resource') ||
    rewrittenUrl.startsWith('/Branch') ||
    rewrittenUrl.startsWith('/MAsterConfig') ||
    rewrittenUrl.startsWith('/auditlog') ||
    rewrittenUrl.startsWith('/config') ||
    rewrittenUrl.startsWith('/group');

  if (isAdminRequest) {
    let normalizedPath = rewrittenUrl;
    if (rewrittenUrl.startsWith('/api/v1/admin')) {
      // Keep as-is
    } else {
      const legacyPath = rewrittenUrl.startsWith('/api') ? rewrittenUrl : '/api' + rewrittenUrl;
      normalizedPath = legacyPath.replace('/api/', '/api/v1/admin/');
    }
    rewrittenUrl = `${adminApiUrl}${normalizedPath}`;
  } else if (rewrittenUrl.startsWith('/api/v1')) {
    const rest = rewrittenUrl.slice('/api/v1'.length); // e.g. "/auth/login", "/projects/123/gallery"
    
    // Perform routing mapping to individual Edge Functions
    if (rest.startsWith('/auth')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/projects') && rest.includes('/gallery')) {
      // Map /projects/:projectId/gallery/:imageId -> /gallery/projects/:projectId/:imageId
      const parts = rest.split('/'); // ["", "projects", "projectId", "gallery", "imageId" (optional)]
      const projectId = parts[2];
      const imageId = parts[4] ? `/${parts[4]}` : '';
      rewrittenUrl = `${supabaseFunctionsUrl}/gallery/projects/${projectId}${imageId}`;
    } else if (rest.startsWith('/projects') && rest.includes('/technologies')) {
      // Map /projects/:projectId/technologies/:techId -> /technologies/projects/:projectId/:techId
      const parts = rest.split('/'); // ["", "projects", "projectId", "technologies", "techId" (optional)]
      const projectId = parts[2];
      const techId = parts[4] ? `/${parts[4]}` : '';
      rewrittenUrl = `${supabaseFunctionsUrl}/technologies/projects/${projectId}${techId}`;
    } else if (rest.startsWith('/projects')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/technologies')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/portfolio')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/rbac')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/menus')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/permissions')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else if (rest.startsWith('/organizations') && rest.includes('/license')) {
      // Map /organizations/:orgId/license/... -> /licensing/:orgId/license/...
      const restLicensing = rest.replace('/organizations', '');
      rewrittenUrl = `${supabaseFunctionsUrl}/licensing${restLicensing}`;
    } else if (rest.startsWith('/licensing')) {
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    } else {
      // Fallback catch-all
      rewrittenUrl = `${supabaseFunctionsUrl}${rest}`;
    }
  } else {
    rewrittenUrl = `${supabaseFunctionsUrl}${rewrittenUrl}`;
  }

  req = req.clone({ url: rewrittenUrl });

  return next(req);
};

