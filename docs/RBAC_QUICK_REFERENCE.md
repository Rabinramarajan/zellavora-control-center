# RBAC Quick Reference

One-page cheatsheet for the team.

## Concepts

| Term | Meaning |
|---|---|
| **Permission** | Atomic capability. Key format: `domain:resource:action` |
| **Role** | Bundle of permissions. Inherits from other roles (DAG). |
| **Hierarchy** | `role_inheritance` — many-to-many. Cycle detection enforced. |
| **Effect** | `allow` or `deny`. **DENY wins.** |
| **Policy Version** | Monotonic per-tenant counter. Used in cache key. |
| **Resource Scope** | `own` / `team` / `department` / `all` — row-level. |

## Five Permission Types

| Type | Use | Example | Enforced by |
|---|---|---|---|
| `feature` | Module toggle | `feature:analytics` | Directive, guard |
| `screen`  | Page access | `screen:admin.users.list` | Route guard |
| `component` | UI control | `component:user.deleteBtn` | Directive |
| `action` | API capability | `users:user:create` | Middleware |
| `database` | Row/column | `db:projects:row.read.own` | Query builder + RLS |

## Hot API Calls

```
GET  /api/v1/rbac/me/policy          # Full effective policy for current user
POST /api/v1/rbac/check              # Bulk check { checks: [keys] }
GET  /api/v1/rbac/roles              # List roles in current org
POST /api/v1/rbac/users/:id/roles    # Assign role
GET  /api/v1/rbac/audit-logs         # Audit search
```

## Server Middleware

```ts
import { requirePermission } from './rbac/middleware/permission.middleware';

router.post('/users', requirePermission('users:user:create'), createUser);
router.get('/billing/*', requireAny(['billing:invoice:read','billing:plan:read']), listInvoices);
```

## Angular Usage

```html
<!-- Directive -->
<button *hasPermission="'users:user:delete'" (click)="del(u)">Delete</button>
<a     *hasRole="'org_admin'" routerLink="/admin">Admin</a>
<tab   *hasFeature="'analytics'">Analytics</tab>

<!-- Signal (reactive in templates) -->
@if (rbac.can('users:user:create')()) { <create-btn/> }

<!-- Guard -->
{ path: 'admin/audit',
  canMatch: [permissionGuard('screen:admin.audit')],
  loadComponent: () => import('./audit/audit.component') }
```

## Wildcards

```
feature:*                  — all features
users:*:create             — all create actions in users domain
*:user:read                — read user across all scopes
```

Use sparingly — wildcards defeat audit clarity.

## Hierarchy Example

```
Super Admin (100)
  └ Org Owner (90)
      └ Org Admin (80)
          ├ Manager (60)
          │   ├ HR (50)
          │   │   └ Recruiter (45)
          │   ├ Finance (50)
          │   ├ Developer (40)
          │   └ Support (35)
          └ Editor (30)
              └ Viewer (10)
```

## Resolution Order

1. Load active user_roles
2. Expand role DAG (BFS, depth ≤ 8)
3. Collect role_permissions (allow + deny)
4. Collect user_permissions (overrides)
5. Apply: **DENY wins** (overrides always, role deny over role allow)
6. Result = effective allowed set

## Cache Key

```
rbac:policy:{orgId}:{userId}:v{policyVersion}
```

Any policy mutation bumps `policy_versions.version` → all keys auto-expire.

## Audit Hash Chain

Each row stores `hash = sha256(prev_hash || row)`. Tampering breaks the chain. Verify with `verify_audit_chain(org_id)` SQL function.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Hiding UI but skipping server check | Always re-check on server — UI hiding is cosmetic. |
| Forgetting to invalidate cache after policy change | The DB trigger bumps version; cache key includes it. Manual `invalidateOrg` is also safe. |
| Wildcard like `*` for everything | Avoid — at least keep the action suffix. |
| Inheritance cycle | DB trigger blocks it; service pre-checks for fast failure. |
| Cross-tenant role assignment | Service checks `role.organization_id == tenant` or `is_system`. |
