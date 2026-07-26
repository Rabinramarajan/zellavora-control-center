// Default local Supabase Edge Functions base URL
const SUPABASE_FUNCTIONS_URL = 'http://localhost:54321/functions/v1';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept relative API requests
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    let rewrittenUrl = req.url;

    // Remove leading /api/v1 if present
    if (rewrittenUrl.startsWith('/api/v1')) {
      const rest = rewrittenUrl.slice('/api/v1'.length); // e.g. "/auth/login", "/projects/123/gallery"
      
      // Perform routing mapping to individual Edge Functions
      if (rest.startsWith('/auth')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/projects') && rest.includes('/gallery')) {
        // Map /projects/:projectId/gallery/:imageId -> /gallery/projects/:projectId/:imageId
        const parts = rest.split('/'); // ["", "projects", "projectId", "gallery", "imageId" (optional)]
        const projectId = parts[2];
        const imageId = parts[4] ? `/${parts[4]}` : '';
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}/gallery/projects/${projectId}${imageId}`;
      } else if (rest.startsWith('/projects') && rest.includes('/technologies')) {
        // Map /projects/:projectId/technologies/:techId -> /technologies/projects/:projectId/:techId
        const parts = rest.split('/'); // ["", "projects", "projectId", "technologies", "techId" (optional)]
        const projectId = parts[2];
        const techId = parts[4] ? `/${parts[4]}` : '';
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}/technologies/projects/${projectId}${techId}`;
      } else if (rest.startsWith('/projects')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/technologies')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/portfolio')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/rbac')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/menus')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/permissions')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else if (rest.startsWith('/organizations') && rest.includes('/license')) {
        // Map /organizations/:orgId/license/... -> /licensing/:orgId/license/...
        const restLicensing = rest.replace('/organizations', '');
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}/licensing${restLicensing}`;
      } else if (rest.startsWith('/licensing')) {
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      } else {
        // Fallback catch-all
        rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rest}`;
      }
    } else {
      rewrittenUrl = `${SUPABASE_FUNCTIONS_URL}${rewrittenUrl}`;
    }

    req = req.clone({ url: rewrittenUrl });
  }

  return next(req);
};
