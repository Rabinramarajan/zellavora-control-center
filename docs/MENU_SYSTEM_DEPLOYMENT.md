# Dynamic Menu System - Deployment Checklist

## 📋 Pre-Deployment Verification

### Code Quality
- [ ] All TypeScript files compile without errors
- [ ] No TypeScript strict mode violations
- [ ] ESLint passes all rules
- [ ] No console.log statements in production code
- [ ] All imports resolved correctly
- [ ] No circular dependencies

```bash
# Verify
npm run build      # Frontend
npm run build:api  # Backend
npm run lint       # Linting
```

### Security Audit
- [ ] No hardcoded secrets in code
- [ ] No exposed API keys
- [ ] SQL injection prevention verified
- [ ] XSS protection implemented (HTML sanitization)
- [ ] CSRF protection if applicable
- [ ] RLS policies verified
- [ ] Permission checks on all endpoints
- [ ] Token expiration configured

### Database
- [ ] Migration file created: `0010_dynamic_menus.sql`
- [ ] All 5 tables defined correctly
- [ ] All indexes created
- [ ] RLS policies configured
- [ ] Triggers set up
- [ ] Foreign key constraints verified
- [ ] Soft delete logic tested

```bash
# Test migration locally
supabase migration test 0010_dynamic_menus
```

## 🔧 Deployment Steps

### Step 1: Database Migration (Required)
```bash
# Apply to Supabase
supabase db push --remote

# Or manual in Supabase dashboard
# SQL Editor → Copy 0010_dynamic_menus.sql content → Execute
```

**Verification:**
```sql
-- Verify tables exist
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'menu%';

-- Should return:
-- menus
-- menu_usage
-- menu_categories
-- menu_versions
-- menu_cache_state
```

### Step 2: Backend Integration
```bash
# Install dependencies (if any new ones added)
cd apps/backend
npm install

# Build
npm run build

# Test locally
npm run dev
```

**In your Express app (`apps/backend/src/index.ts`):**
```typescript
// Add these imports
import { createMenuRoutes } from './routes/menus';
import { MenuService } from './services/menu.service';
import { FeatureFlagService } from './services/feature-flag.service';
import { PermissionService } from './services/permission.service';

// Initialize services (after creating supabase client)
const menuService = new MenuService(
  supabase,
  redisClient,  // Your Redis instance
  new FeatureFlagService(supabase),
  new PermissionService(supabase)
);

// Mount routes (before other routes)
app.use('/api/v1/menus', createMenuRoutes(menuService));
```

**Test endpoints:**
```bash
# Get menu tree (requires auth token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/menus

# Should return: { items: [], timestamp: "...", version: 1, categories: [] }
```

### Step 3: Frontend Integration
```bash
# Install dependencies (if needed)
cd apps/admin
npm install

# Build
npm run build

# Test locally
npm run dev
```

**In your app layout (`apps/admin/src/app/app.component.ts`):**
```typescript
import { SidebarComponent } from './shared/components/sidebar.component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SidebarComponent, RouterOutlet],
  template: `
    <div class="layout">
      <app-sidebar></app-sidebar>
      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
    }
    .content {
      flex: 1;
      margin-left: 16rem;  /* Sidebar width */
    }
    @media (max-width: 768px) {
      .content {
        margin-left: 0;
      }
    }
  `]
})
export class AppComponent {}
```

**Verify in browser:**
- Navigate to app
- Sidebar should appear
- Menu should load (initially empty until seeded)
- No console errors

### Step 4: Seed Initial Menus
```bash
# Option 1: Via API (recommended for production)
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "dashboard",
    "label": "Dashboard",
    "route": "/dashboard",
    "icon": "dashboard",
    "category": "main",
    "visible": true,
    "orderIndex": 0
  }' \
  https://your-api.com/api/v1/menus

# Option 2: Via database (for testing)
INSERT INTO menus (
  organization_id, key, label, route, icon, 
  category, visible, order_index, created_by
) VALUES (
  'org-uuid', 'dashboard', 'Dashboard', '/dashboard', 'dashboard',
  'main', true, 0, 'user-uuid'
);
```

### Step 5: Test All Features

#### Test 1: Menu Loading
```bash
# Get menu tree
curl -H "Authorization: Bearer $TOKEN" \
  http://your-api.com/api/v1/menus

# Expected: Non-empty items array
```

#### Test 2: Favorites
```bash
# Toggle favorite
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://your-api.com/api/v1/menus/{menuId}/favorite

# Get favorites
curl -H "Authorization: Bearer $TOKEN" \
  http://your-api.com/api/v1/menus/user/favorites
```

#### Test 3: Permissions
```bash
# Create menu with permission
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "admin-only",
    "label": "Admin Panel",
    "requiredPermission": "admin:access",
    "visible": true
  }' \
  http://your-api.com/api/v1/menus

# User without permission should not see it
```

#### Test 4: Feature Flags
```bash
# Create menu with feature flag
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "beta-feature",
    "label": "Beta Feature",
    "featureFlag": "beta-enabled",
    "visible": true
  }' \
  http://your-api.com/api/v1/menus

# Menu should only appear if feature flag enabled
```

#### Test 5: Responsive Design
```bash
# In browser:
- Full desktop view (sidebar visible)
- Tablet view (sidebar hidden, hamburger shows)
- Mobile view (hamburger button, overlay)
- Collapse/expand sidebar
```

#### Test 6: Dark Mode
```bash
# In browser:
- Toggle OS dark mode
- Sidebar should switch colors automatically
```

#### Test 7: Accessibility
```bash
# In browser:
- Tab through menu items
- Keyboard navigation works
- ARIA labels present
- Screen reader friendly
```

## 📦 Deployment to Production

### Option A: Vercel (Frontend) + Heroku/Railway (Backend)

**Frontend (Vercel):**
```bash
cd apps/admin
npm run build
vercel deploy --prod
```

**Backend (Heroku):**
```bash
cd apps/backend
git push heroku main
```

### Option B: Docker Deployment

**Backend Dockerfile:**
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
EXPOSE 3000
CMD npm start
```

**Deploy:**
```bash
docker build -t menu-system-api .
docker run -p 3000:3000 -e DATABASE_URL=$DB_URL menu-system-api
```

### Option C: Supabase + Cloudflare Workers

**Frontend:**
```bash
# Deploy Angular build to Cloudflare Pages
npx wrangler pages deploy dist/apps/admin
```

**Backend:**
```bash
# Deploy to Supabase Edge Functions or keep existing Express
# API routes remain the same
```

## 🧪 Post-Deployment Testing

### Smoke Tests (5 min)
```bash
# 1. Health check
curl https://your-api.com/health

# 2. Menu endpoint
curl https://your-api.com/api/v1/menus

# 3. Frontend loads
curl https://your-frontend.com/

# 4. No console errors
# Check browser console
```

### Integration Tests (15 min)
```bash
# Run test suite
npm run test:e2e

# Verify:
# - Menu tree loads
# - User can click items
# - Favorites work
# - Permissions enforced
# - No errors in logs
```

### Performance Tests (10 min)
```bash
# Check load times
# - Menu tree load: < 500ms
# - Search: < 50ms
# - Click response: < 100ms

# Check Lighthouse
# - Performance: 90+
# - Accessibility: 95+
```

## 📊 Monitoring Setup

### Logging
```typescript
// Add to backend
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log important events
logger.info('Menu loaded', { organizationId, itemCount });
logger.error('Permission denied', { userId, menuId });
```

### Metrics
```typescript
// Track key metrics
const menuLoadTime = performance.now();
const items = await menuService.getMenuTree(orgId, userId);
const duration = performance.now() - menuLoadTime;

console.log(`Menu load time: ${duration}ms`);
```

### Alerts
- [ ] Error rate > 1%
- [ ] Response time > 1s
- [ ] Cache hit rate < 50%
- [ ] Database connection errors
- [ ] Permission denial spike

## 🚨 Rollback Plan

### If Issues Detected

**Option 1: Quick Rollback**
```bash
# Revert frontend
vercel rollback

# Revert backend
git revert <commit>
git push heroku main
```

**Option 2: Feature Disable**
```typescript
// Disable menu routes temporarily
app.use('/api/v1/menus', (req, res) => {
  res.status(503).json({ error: 'Menu system under maintenance' });
});
```

**Option 3: Database Rollback**
```bash
# Restore from backup
supabase db pull --linked-pull-request

# Or manually drop tables
DROP TABLE menu_versions;
DROP TABLE menu_cache_state;
DROP TABLE menu_usage;
DROP TABLE menu_categories;
DROP TABLE menus;
```

## ✅ Final Checklist

### Before Deployment
- [ ] All files in place
- [ ] TypeScript compiles
- [ ] No secrets in code
- [ ] Database migration tested
- [ ] Backend service initialized
- [ ] Frontend components added
- [ ] API endpoints responding
- [ ] Menus seeded (optional)
- [ ] Tests passing
- [ ] Documentation complete

### Deployment
- [ ] Database migration applied
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Environment variables set
- [ ] SSL certificates valid
- [ ] DNS updated (if needed)
- [ ] Monitoring configured

### Post-Deployment
- [ ] Smoke tests pass
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] Users can see menus
- [ ] Favorites working
- [ ] Permissions enforced
- [ ] Mobile responsive
- [ ] Dark mode working
- [ ] Accessibility passes
- [ ] Monitoring alerts working

## 📞 Support During Deployment

**If Issues Arise:**

1. **Check Logs**
   - Backend: `docker logs menu-api`
   - Frontend: Browser console
   - Database: Supabase dashboard

2. **Common Issues**
   - CORS errors → Check API URL
   - Permission denied → Verify auth token
   - Menu not showing → Check visible flag
   - Slow loading → Check cache status

3. **Contact**
   - Backend issues → Check API logs
   - Database issues → Check Supabase status
   - Frontend issues → Check browser console
   - Permission issues → Verify permissions table

## 📈 Post-Deployment Optimization

### Monitor for 1 Week
- [ ] No critical errors
- [ ] Performance baseline established
- [ ] Cache hit rates > 70%
- [ ] Response times < 200ms
- [ ] User adoption tracking

### Optimize Based on Metrics
- [ ] Increase cache TTL if stable
- [ ] Add indexes if slow queries
- [ ] Adjust batch sizes
- [ ] Fine-tune permission checks

---

## Deployment Summary

| Step | Time | Status |
|------|------|--------|
| Database Migration | 5 min | ⏳ |
| Backend Integration | 10 min | ⏳ |
| Frontend Integration | 10 min | ⏳ |
| Seed Menus | 5 min | ⏳ |
| Smoke Tests | 5 min | ⏳ |
| Full Testing | 20 min | ⏳ |
| **Total** | **~55 min** | **⏳** |

**Estimated Production Readiness: 1 hour**

---

**Deployment Status:** Ready for Production  
**Last Updated:** 2026-07-26  
**Version:** 1.0.0
