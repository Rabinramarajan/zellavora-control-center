# Enterprise RBAC Architecture

**Project:** Zellavora Control Center (ZCC)
**Version:** 1.0
**Status:** Design — Ready for Implementation
**Stack:** Angular 22 · Express (TypeScript) · PostgreSQL (Supabase) · Redis

---

## 0. Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Core Concepts & Domain Model](#2-core-concepts--domain-model)
3. [Permission Taxonomy (5 Layers)](#3-permission-taxonomy-5-layers)
4. [Role Hierarchy & Inheritance](#4-role-hierarchy--inheritance)
5. [Database Design](#5-database-design)
6. [Permission Resolution Engine](#6-permission-resolution-engine)
7. [Caching Strategy](#7-caching-strategy)
8. [REST API Surface](#8-rest-api-surface)
9. [Backend Implementation](#9-backend-implementation)
10. [Angular Implementation](#10-angular-implementation)
11. [Dynamic UI Authorization](#11-dynamic-ui-authorization)
12. [Route Guards](#12-route-guards)
13. [Audit Logging](#13-audit-logging)
14. [UI Permission Management](#14-ui-permission-management)
15. [Security Model](#15-security-model)
16. [Performance Budgets](#16-performance-budgets)
17. [Migration & Seed Plan](#17-migration--seed-plan)
18. [Testing Strategy](#18-testing-strategy)
19. [Operational Runbook](#19-operational-runbook)

---

## 1. Goals & Non-Goals

### Goals
- **Unlimited roles per organization**, no hard-coded enum.
- **Five permission layers** in one engine: feature, screen, component, action, database.
- **DAG-based role hierarchy** with cycle detection and transitive inheritance.
- **Explicit DENY beats implicit ALLOW** (defense in depth).
- **Sub-millisecond permission checks** via two-level cache.
- **Multi-tenant isolated** (per-organization policy).
- **Auditable**: every deny and every mutation is logged.
- **Hot-reloadable policy**: change a role at runtime, take effect within seconds.
- **Reusable across any Angular + Node + PostgreSQL stack**.

### Non-Goals (v1)
- ABAC attribute expressions beyond resource scope (deferred to v2).
- External IdP claims mapping (SAML/OIDC) — handled by Supabase Auth in v1.
- Distributed multi-region policy replication — single primary.

---

## 2. Core Concepts & Domain Model

```
┌────────────────────────────────────────────────────────────────────┐
│                         RBAC Domain Model                          │
└────────────────────────────────────────────────────────────────────┘

   User ──┬── UserRole ──→ Role ──┬── RolePermission ──→ Permission
          │                        │                           ▲
          ├── UserPermission       ├── RoleInheritance ──┐    │
          │   (override)           │   (parent role)     │    │
          │                        │                     │    │
          │                        └─ (self reference) ◄─┘    │
          │                                                  │
          │                       PermissionGroup ────────────┘
          │                       (groups perms by domain)
          │
          └── Session ──→ (policy_version, ttl)
```

### Glossary

| Term | Definition |
|------|------------|
| **User** | Authenticated identity. Globally unique. |
| **Role** | Named bundle of permissions, scoped to a tenant (or system-wide). |
| **Permission** | Atomic capability: `domain:resource:action` (e.g. `users:user:create`). |
| **Permission Group** | Reusable bundle of permissions, e.g. "User Management", "Billing". |
| **Role Inheritance** | Role A inherits all permissions from Role B (DAG, not tree). |
| **User Role Assignment** | A user holds a role within a tenant, optionally scoped to a resource. |
| **Direct Permission** | Permission granted/denied directly to a user (override). |
| **Policy Version** | Monotonic integer bumped on any policy mutation; used as cache key. |
| **Resource Scope** | Optional narrowing of an action to a specific resource (row/column). |

---

## 3. Permission Taxonomy (5 Layers)

Every permission is stored as one row in the `permissions` table, distinguished by `type`:

| Type | Key format | Example | Resolved by |
|------|-----------|---------|-------------|
| **Feature** | `feature:<module>` | `feature:analytics`, `feature:reports` | Permission Engine |
| **Screen** | `screen:<route>` | `screen:admin.users.list` | Router Guards + UI |
| **Component** | `component:<id>` | `component:user.deleteBtn` | Structural Directive |
| **Action** | `<resource>:<action>` | `users:user:create`, `posts:post:publish` | API Middleware |
| **Database** | `db:<table>:<scope>` | `db:projects:row.update.own` | RLS / Query filter |

### 3.1 Feature Permissions
Coarse toggle. Used for paid modules, beta features, soft-launches.
```ts
{ key: 'feature:analytics', type: 'feature', label: 'Analytics Module' }
```

### 3.2 Screen Permissions
Maps 1:1 to a route. Allows entire page or hides it.
```ts
{ key: 'screen:admin.audit', type: 'screen', label: 'Audit Log Page' }
```

### 3.3 Component Permissions
Granular UI control — hide a button, disable a tab, mask a field.
```ts
{ key: 'component:user.list.deleteBtn', type: 'component', label: 'Delete User Button' }
```

### 3.4 Action Permissions
Domain-level capability. The bread-and-butter of API authorization.
```ts
{ key: 'users:user:create', type: 'action', label: 'Create User' }
{ key: 'posts:post:publish', type: 'action', label: 'Publish Post' }
```

### 3.5 Database Permissions
Row/column level. Enforced both at the RLS layer and at the query builder.
```ts
{ key: 'db:projects:row.read.own', type: 'database', label: 'Read own projects' }
{ key: 'db:invoices:col.read.amount', type: 'database', label: 'View invoice amount' }
```

### 3.6 Wildcard Matching
Engine supports glob patterns with `*`:
- `users:*:create` — all create actions on users domain
- `*:user:read` — read user across all scopes
- `feature:*` — every feature

Used carefully — too many wildcards defeat audit clarity.

---

## 4. Role Hierarchy & Inheritance

### 4.1 DAG, Not Tree
A role can inherit from multiple parents. We model this with an explicit `role_inheritance` table (DAG) rather than a `parent_role_id` column.

```sql
CREATE TABLE role_inheritance (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  parent_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, parent_role_id),
  CHECK (role_id <> parent_role_id)
);
```

### 4.2 Example Hierarchy

```
                ┌──────────────┐
                │ Super Admin  │  (system, all perms)
                └──────┬───────┘
                       │ inherits
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐
   │ Org     │   │ Org      │   │ System   │
   │ Owner   │   │ Admin    │   │ Auditor  │
   └────┬────┘   └────┬─────┘   └──────────┘
        │             │
        │             ├── inherits ──→ Manager ──→ HR ──→ Recruiter
        │             │                  │            └── Finance
        │             │                  └── Developer
        │             │                  └── Support
        │             └── Editor ──→ Viewer
        │
        └── Client Admin (per-org variant of Org Admin)
```

### 4.3 Resolution Order

When evaluating a user's effective permissions:

1. Collect all **direct user role assignments** (status=active, validity window).
2. Expand **role inheritance DAG** (cycle-checked, BFS).
3. For each effective role, collect all **granted permissions**.
4. Apply **direct user permissions** (ALLOW / DENY) — DENY wins.
5. Apply **role-level DENY** (a role can explicitly deny a permission it would otherwise inherit).
6. Result = final effective set.

### 4.4 Cycle Detection
At role-creation / inheritance-link time, run a CTE to check for cycles. Database trigger rejects.
```sql
CREATE OR REPLACE FUNCTION check_role_inheritance_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT NEW.parent_role_id AS id
      UNION ALL
      SELECT ri.parent_role_id FROM role_inheritance ri
      JOIN chain c ON ri.role_id = c.id
    )
    SELECT 1 FROM chain WHERE id = NEW.role_id
  ) THEN
    RAISE EXCEPTION 'Role inheritance cycle detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.5 Depth Limit
Max 8 levels of inheritance to prevent DoS via crafted cycles. Enforced in app + DB.

---

## 5. Database Design

### 5.1 Entity-Relationship Diagram

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  users   │────┐    │  user_roles  │         │    roles     │◄──┐
└──────────┘    │    │  (scope,ttl) │──┐      │  (tenant)    │───┤
                └────┤                │      └──────┬───────┘   │
                     │                │             │           │
                     ▼                ▼             │           │
              ┌──────────────┐  ┌────────────┐      │           │
              │  user_perms  │  │   roles    │◄─────┤           │
              │  (override)  │  └────────────┘      │           │
              └──────┬───────┘                       │           │
                     │                               │           │
                     │       ┌───────────────────────┘           │
                     ▼       ▼                                   │
              ┌─────────────────────┐    ┌───────────────────┐   │
              │      permissions    │◄───│  role_permissions │   │
              │  (key, type, group) │    │  (effect:ALLOW|   │   │
              └──────────┬──────────┘    │         DENY)     │   │
                         │               └───────────────────┘   │
                         │                                        │
              ┌──────────▼──────────┐    ┌───────────────────┐     │
              │ permission_groups   │    │ role_inheritance  │─────┘
              │ (User Mgmt, Billing)│    │  (DAG edges)      │
              └─────────────────────┘    └───────────────────┘

       ┌────────────────────┐  ┌─────────────────┐  ┌─────────────────┐
       │ resource_scopes    │  │   audit_logs    │  │ policy_versions │
       │ (row/col level)    │  │  (immutable)    │  │  (per-tenant)   │
       └────────────────────┘  └─────────────────┘  └─────────────────┘
```

### 5.2 Tables

#### 5.2.1 `permissions`
```sql
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(200) UNIQUE NOT NULL,        -- e.g. users:user:create
  type        permission_type NOT NULL,            -- feature|screen|component|action|database
  label       VARCHAR(200) NOT NULL,
  description TEXT,
  group_id    UUID REFERENCES permission_groups(id) ON DELETE SET NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- severity, ui_hints, etc.
  is_system   BOOLEAN NOT NULL DEFAULT false,      -- protected, can't delete
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE permission_type AS ENUM ('feature','screen','component','action','database');

CREATE INDEX idx_permissions_type ON permissions(type);
CREATE INDEX idx_permissions_group ON permissions(group_id);
CREATE INDEX idx_permissions_key_pattern ON permissions(key text_pattern_ops);
```

#### 5.2.2 `permission_groups`
```sql
CREATE TABLE permission_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,    -- e.g. user_management
  label       VARCHAR(200) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permission_groups (key, label, sort_order) VALUES
  ('user_management', 'User Management', 10),
  ('content',         'Content & CMS',   20),
  ('billing',         'Billing & Plans', 30),
  ('analytics',       'Analytics',       40),
  ('security',        'Security & Audit',50),
  ('system',          'System',          60);
```

#### 5.2.3 `roles`
```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = system role
  key             VARCHAR(100) NOT NULL,           -- e.g. super_admin
  label           VARCHAR(200) NOT NULL,
  description     TEXT,
  level           INT NOT NULL DEFAULT 0,            -- informational hierarchy hint
  is_system       BOOLEAN NOT NULL DEFAULT false,    -- built-in, can't delete
  color           VARCHAR(20),                       -- UI chip color
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
```

#### 5.2.4 `role_permissions`
```sql
CREATE TYPE permission_effect AS ENUM ('allow','deny');

CREATE TABLE role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect         permission_effect NOT NULL DEFAULT 'allow',
  conditions     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. {"tenant_match": true}
  granted_by     UUID REFERENCES users(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_perms_perm ON role_permissions(permission_id);
```

#### 5.2.5 `role_inheritance`
```sql
CREATE TABLE role_inheritance (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  parent_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, parent_role_id),
  CHECK (role_id <> parent_role_id)
);
```

#### 5.2.6 `user_roles`
```sql
CREATE TYPE role_assignment_status AS ENUM ('active','suspended','expired');

CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   VARCHAR(50),          -- e.g. 'project' for project-scoped role
  resource_id     UUID,                 -- the specific project
  status          role_assignment_status NOT NULL DEFAULT 'active',
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,          -- NULL = indefinite
  assigned_by     UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES users(id),
  revoke_reason   TEXT
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE status = 'active';
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_org  ON user_roles(organization_id);
CREATE INDEX idx_user_roles_resource ON user_roles(resource_type, resource_id)
  WHERE resource_id IS NOT NULL;
```

#### 5.2.7 `user_permissions` (Direct Overrides)
```sql
CREATE TABLE user_permissions (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect          permission_effect NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   VARCHAR(50),
  resource_id     UUID,
  valid_until     TIMESTAMPTZ,
  granted_by      UUID REFERENCES users(id),
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id, organization_id)
);
```

#### 5.2.8 `resource_scopes` (Database-level)
```sql
CREATE TABLE resource_scopes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   VARCHAR(50) NOT NULL,    -- 'project', 'invoice', etc.
  scope           VARCHAR(20) NOT NULL,    -- 'own' | 'team' | 'department' | 'all'
  conditions      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. {"team_id": "..."}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_res_scopes_lookup ON resource_scopes(user_id, organization_id, resource_type);
```

#### 5.2.9 `policy_versions`
```sql
CREATE TABLE policy_versions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  version         BIGINT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id)
);

-- Bump on every policy mutation
CREATE OR REPLACE FUNCTION bump_policy_version() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO policy_versions (organization_id, version, updated_at)
  VALUES (COALESCE(NEW.organization_id, OLD.organization_id), 1, now())
  ON CONFLICT (organization_id) DO UPDATE
    SET version = policy_versions.version + 1, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers on every RBAC table
CREATE TRIGGER trg_bump_v_role_perms
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();
-- (and similar for user_roles, role_inheritance, user_permissions, etc.)
```

#### 5.2.10 `audit_logs`
```sql
CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email     VARCHAR(200),
  action          VARCHAR(100) NOT NULL,        -- 'role.create','permission.deny','login', etc.
  resource_type   VARCHAR(50),                   -- 'role','permission','user_role', etc.
  resource_id     UUID,
  decision        VARCHAR(20),                   -- 'allow' | 'deny' | NULL
  permission_key  VARCHAR(200),                  -- for check decisions
  description     TEXT,
  old_values      JSONB,
  new_values      JSONB,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- IP, user agent, route
  prev_hash       CHAR(64),                      -- hash chain for tamper-evidence
  hash            CHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org_time ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_actor    ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action   ON audit_logs(action, created_at DESC);
```

> See section 13 for hash-chain details.

---

## 6. Permission Resolution Engine

### 6.1 Algorithm

```ts
async function resolvePermissions(
  userId: string,
  orgId: string
): Promise<EffectivePolicy> {
  // 1. Load user's direct active role assignments
  const assignments = await db.user_roles.findMany({
    where: { user_id: userId, organization_id: orgId, status: 'active' }
  });

  // 2. Expand role DAG (BFS, cycle-safe)
  const effectiveRoles = await expandRoleGraph(assignments.map(a => a.role_id));

  // 3. Collect all permissions from effective roles
  const rolePerms = await db.role_permissions.findMany({
    where: { role_id: { in: effectiveRoles } }
  });

  // 4. Collect user-level overrides
  const userOverrides = await db.user_permissions.findMany({
    where: { user_id: userId, organization_id: orgId }
  });

  // 5. Resolve: DENY wins
  const allowed = new Set<string>();
  const denied  = new Set<string>();

  for (const p of rolePerms) {
    (p.effect === 'deny' ? denied : allowed).add(p.permission.key);
  }
  for (const u of userOverrides) {
    (u.effect === 'deny' ? denied : allowed).add(u.permission.key);
  }
  for (const k of denied) allowed.delete(k);

  return { allowed: [...allowed], denied: [...denied], roles: effectiveRoles, version: ... };
}
```

### 6.2 Single-Permission Check

```ts
async function check(
  userId: string,
  orgId: string,
  permissionKey: string
): Promise<{ allowed: boolean; source: 'role' | 'override' | 'inherited' | 'deny' | null }> {
  const policy = await resolvePermissions(userId, orgId);

  if (policy.denied.includes(permissionKey))  return { allowed: false, source: 'deny' };
  if (policy.allowed.includes(permissionKey)) return { allowed: true,  source: 'role' };

  // Wildcard fallback
  for (const key of policy.allowed) {
    if (matchesGlob(key, permissionKey)) return { allowed: true, source: 'inherited' };
  }
  return { allowed: false, source: null };
}
```

### 6.3 Complexity
- `resolvePermissions` is O(R + P) where R = effective role count, P = permissions.
- For typical users (1-3 direct roles, ~50 effective perms): **< 1 ms** with hot cache.
- DAG expansion: BFS with visited set, O(V + E).

### 6.4 Policy Version Pinning
Every check response includes `policy_version`. The client compares with its cached version; on mismatch, it refetches. This is the cornerstone of cache invalidation (see §7).

---

## 7. Caching Strategy

Three-tier, designed for hot reads with cold invalidation.

```
┌──────────────────────────────────────────────────────────────┐
│  L0  Browser/Client memory (Angular signals)  TTL: session   │
│  L1  Node process memory (LRU map)            TTL: 60 s       │
│  L2  Redis (shared across instances)          TTL: 300 s      │
│  DB  PostgreSQL                              source of truth │
└──────────────────────────────────────────────────────────────┘
```

### 7.1 Cache Key

```
rbac:policy:{orgId}:{userId}:v{policyVersion}
```

The policy version is part of the key, so any change to policy auto-expires all keys.

### 7.2 L1 In-Process Cache
- Bounded LRU map (max 10,000 entries).
- Key: `${userId}:${orgId}:${version}`, value: serialized `EffectivePolicy`.
- TTL 60 s. (Even if version stays same, force refresh.)
- Process-local; no shared invalidation needed.

### 7.3 L2 Redis Cache
- `SET rbac:policy:{org}:{user}:v{N} {json} EX 300`
- Negative cache: `SET rbac:deny:{org}:{user}:{key} 1 EX 60` for fast denials.
- Pub/Sub channel `rbac:invalidate:{orgId}` for instant invalidation.

### 7.4 Invalidation

When ANY of these happen, the system bumps `policy_versions.version` and publishes to Redis:

- Role created / updated / deleted
- Role permission granted / revoked
- Role inheritance changed
- User role assigned / revoked
- Direct user permission override
- Permission group membership changed

```ts
async function onPolicyChange(orgId: string) {
  await db.policy_versions.increment(orgId);
  await redis.publish(`rbac:invalidate:${orgId}`, JSON.stringify({ orgId, ts: Date.now() }));
  // Each instance subscribes; on message, evicts its L1 cache
}
```

### 7.5 JWT Policy Pinning
JWT carries `policy_version` claim. If the version in the token is older than the org's current version, the API forces a permission re-resolve (and rotates the token on the way out).

### 7.6 Cache Stampede Protection
On miss, only one coroutine (per key) hits the DB — `single-flight` pattern using Redis `SETNX` lock with 5 s TTL.

---

## 8. REST API Surface

All endpoints are versioned: `/api/v1/rbac/*`.
All require JWT with `tenantId` claim.
All endpoints that mutate policy require `users:user:manage` or `system:rbac:write`.

### 8.1 Permissions
```
GET    /api/v1/rbac/permissions                 # List (filter by type, group)
GET    /api/v1/rbac/permissions/:key            # Get one
POST   /api/v1/rbac/permissions                 # Create (system only)
PATCH  /api/v1/rbac/permissions/:key            # Update label/description
DELETE /api/v1/rbac/permissions/:key            # Delete (only if not in use)
```

### 8.2 Permission Groups
```
GET    /api/v1/rbac/permission-groups
POST   /api/v1/rbac/permission-groups
PATCH  /api/v1/rbac/permission-groups/:id
DELETE /api/v1/rbac/permission-groups/:id
```

### 8.3 Roles
```
GET    /api/v1/rbac/roles                       # List (paginated)
GET    /api/v1/rbac/roles/:id                   # Detail with permissions + inheritance
POST   /api/v1/rbac/roles                       # Create
PATCH  /api/v1/rbac/roles/:id                   # Update label/color/description
DELETE /api/v1/rbac/roles/:id                   # Delete (rejects if assigned)

# Permissions
PUT    /api/v1/rbac/roles/:id/permissions       # Replace permission set
POST   /api/v1/rbac/roles/:id/permissions       # Add permission (with effect)
DELETE /api/v1/rbac/roles/:id/permissions/:pid  # Remove

# Inheritance
PUT    /api/v1/rbac/roles/:id/inheritance       # Replace parent set
POST   /api/v1/rbac/roles/:id/inheritance       # Add parent
DELETE /api/v1/rbac/roles/:id/inheritance/:pid  # Remove parent

# Clone
POST   /api/v1/rbac/roles/:id/clone             # Duplicate role
```

### 8.4 User Role Assignment
```
GET    /api/v1/rbac/users/:userId/roles                  # List active assignments
POST   /api/v1/rbac/users/:userId/roles                  # Assign role
DELETE /api/v1/rbac/users/:userId/roles/:assignmentId    # Revoke

# Bulk
POST   /api/v1/rbac/users/bulk-assign                    # Assign role to many users
```

### 8.5 Direct User Permissions (Overrides)
```
GET    /api/v1/rbac/users/:userId/permissions
POST   /api/v1/rbac/users/:userId/permissions
DELETE /api/v1/rbac/users/:userId/permissions/:pid
```

### 8.6 Permission Check (Frontend Hot Path)
```
POST   /api/v1/rbac/check
Body:  { checks: [{ permission: "users:user:create", resource?: {...} }, ...] }
Resp:  { results: [{ permission, allowed, source }], policy_version }

# Bulk optimization — single round-trip for many checks.
# Returns only the source (role/inherited/override) and not the full policy.
```

### 8.7 Resolve (Login / Refresh)
```
GET    /api/v1/rbac/me/policy
Resp:  { roles: [...], allowed: [...], denied: [...], version, source: 'cache'|'fresh' }
```

### 8.8 Resource Scopes
```
GET    /api/v1/rbac/users/:userId/scopes
PUT    /api/v1/rbac/users/:userId/scopes/:resourceType
```

### 8.9 Audit
```
GET    /api/v1/rbac/audit-logs?actor=&action=&from=&to=&page=
```

### 8.10 System (Bootstrap)
```
POST   /api/v1/rbac/system/seed-defaults       # idempotent system roles + perms
POST   /api/v1/rbac/system/clone-to-tenant     # clone system roles to org
```

### 8.11 Error Envelope
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Missing permission: users:user:delete",
    "details": { "required": "users:user:delete", "actor": "..." }
  }
}
```

---

## 9. Backend Implementation

### 9.1 Module Layout

```
apps/backend/src/
├── rbac/
│   ├── engine/
│   │   ├── permission-engine.ts        # Core resolution logic
│   │   ├── inheritance.ts              # DAG expansion
│   │   ├── matcher.ts                  # Wildcard / glob matching
│   │   └── types.ts                    # EffectivePolicy, etc.
│   ├── cache/
│   │   ├── policy-cache.ts             # L1 + L2 wrapper
│   │   ├── redis.ts                    # Redis client
│   │   └── invalidator.ts              # Pub/Sub listener
│   ├── repositories/
│   │   ├── permission.repo.ts
│   │   ├── role.repo.ts
│   │   ├── user-role.repo.ts
│   │   └── audit.repo.ts
│   ├── services/
│   │   ├── rbac.service.ts             # Facade
│   │   ├── permission.service.ts
│   │   ├── role.service.ts
│   │   └── user-role.service.ts
│   ├── controllers/
│   │   ├── permission.controller.ts
│   │   ├── role.controller.ts
│   │   ├── user-role.controller.ts
│   │   └── check.controller.ts
│   ├── middleware/
│   │   ├── permission.middleware.ts    # requirePermission('users:user:create')
│   │   └── policy-version.middleware.ts
│   └── index.ts
```

### 9.2 Permission Engine — Core Code

```ts
// apps/backend/src/rbac/engine/permission-engine.ts
import { RoleRepo } from '../repositories/role.repo';
import { PermissionRepo } from '../repositories/permission.repo';
import { UserRoleRepo } from '../repositories/user-role.repo';
import { PolicyCache } from '../cache/policy-cache';
import { expandRoleGraph } from './inheritance';
import { matchesGlob } from './matcher';

export interface EffectivePolicy {
  userId: string;
  orgId: string;
  version: number;
  allowed: string[];
  denied: string[];
  roles: { id: string; key: string; label: string }[];
  resolvedAt: number;
}

export class PermissionEngine {
  constructor(
    private roleRepo: RoleRepo,
    private permRepo: PermissionRepo,
    private userRoleRepo: UserRoleRepo,
    private cache: PolicyCache
  ) {}

  async resolve(userId: string, orgId: string): Promise<EffectivePolicy> {
    const version = await this.getPolicyVersion(orgId);
    const cached = await this.cache.get(userId, orgId, version);
    if (cached) return cached;

    return this.cache.setWithLock(userId, orgId, version, async () => {
      const assignments = await this.userRoleRepo.findActive(userId, orgId);
      const roleIds = assignments.map(a => a.role_id);
      const effectiveRoles = await expandRoleGraph(this.roleRepo, roleIds);

      const rolePerms = await this.permRepo.findByRoles(effectiveRoles);
      const userOverrides = await this.permRepo.findUserOverrides(userId, orgId);

      const allowed = new Set<string>();
      const denied  = new Set<string>();

      for (const rp of rolePerms) {
        (rp.effect === 'deny' ? denied : allowed).add(rp.permission.key);
      }
      for (const u of userOverrides) {
        (u.effect === 'deny' ? denied : allowed).add(u.permission.key);
      }
      for (const k of denied) allowed.delete(k);

      return {
        userId, orgId, version,
        allowed: [...allowed],
        denied: [...denied],
        roles: effectiveRoles.map(r => ({ id: r.id, key: r.key, label: r.label })),
        resolvedAt: Date.now()
      };
    });
  }

  async check(
    userId: string,
    orgId: string,
    permission: string,
    ctx?: { resourceType?: string; resourceId?: string }
  ): Promise<{ allowed: boolean; source: string | null }> {
    const policy = await this.resolve(userId, orgId);
    if (policy.denied.includes(permission))  return { allowed: false, source: 'deny' };
    if (policy.allowed.includes(permission)) return { allowed: true,  source: 'role' };

    for (const key of policy.allowed) {
      if (matchesGlob(key, permission)) return { allowed: true, source: 'inherited' };
    }
    return { allowed: false, source: null };
  }

  async checkMany(
    userId: string,
    orgId: string,
    permissions: string[]
  ): Promise<{ results: Array<{ permission: string; allowed: boolean; source: string | null }>; version: number }> {
    const policy = await this.resolve(userId, orgId);
    const results = permissions.map(p => {
      if (policy.denied.includes(p))  return { permission: p, allowed: false, source: 'deny' };
      if (policy.allowed.includes(p)) return { permission: p, allowed: true,  source: 'role' };
      const inherited = policy.allowed.find(k => matchesGlob(k, p));
      return { permission: p, allowed: !!inherited, source: inherited ? 'inherited' : null };
    });
    return { results, version: policy.version };
  }
}
```

### 9.3 Express Middleware

```ts
// apps/backend/src/rbac/middleware/permission.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { PermissionEngine } from '../engine/permission-engine';
import { AuditService } from '../services/audit.service';

export const requirePermission = (key: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId, tenantId } = req.auth!;
    const engine: PermissionEngine = req.app.locals.engine;
    const audit: AuditService = req.app.locals.audit;

    const { allowed, source } = await engine.check(userId, tenantId, key);

    if (!allowed) {
      await audit.log({
        orgId: tenantId,
        actorId: userId,
        action: 'permission.deny',
        permissionKey: key,
        decision: 'deny',
        context: { method: req.method, path: req.path, ip: req.ip, ua: req.get('user-agent') }
      });
      return res.status(403).json({
        error: { code: 'PERMISSION_DENIED', message: `Missing permission: ${key}` }
      });
    }

    next();
  };
```

### 9.4 Controller (Role)

```ts
// apps/backend/src/rbac/controllers/role.controller.ts
import { Router } from 'express';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

const CreateRole = z.object({
  key: z.string().regex(/^[a-z0-9_]{3,50}$/),
  label: z.string().min(1).max(200),
  description: z.string().optional(),
  level: z.number().int().min(0).max(100).default(0),
  inheritsFrom: z.array(z.string().uuid()).default([]),
  permissions: z.array(z.object({
    key: z.string(),
    effect: z.enum(['allow', 'deny']).default('allow')
  })).default([])
});

router.get('/', requirePermission('system:rbac:read'), async (req, res) => {
  const roles = await req.app.locals.roleService.list(req.auth!.tenantId);
  res.json({ data: roles });
});

router.post('/', requirePermission('system:rbac:write'), async (req, res) => {
  const body = CreateRole.parse(req.body);
  const role = await req.app.locals.roleService.create(req.auth!.tenantId, body, req.auth!.userId);
  res.status(201).json({ data: role });
});

router.get('/:id', requirePermission('system:rbac:read'), async (req, res) => {
  const role = await req.app.locals.roleService.getDetail(req.params.id);
  res.json({ data: role });
});

router.put('/:id/permissions', requirePermission('system:rbac:write'), async (req, res) => {
  const body = z.array(z.object({
    key: z.string(),
    effect: z.enum(['allow', 'deny'])
  })).parse(req.body);
  await req.app.locals.roleService.setPermissions(req.params.id, body, req.auth!.userId);
  res.json({ data: { ok: true } });
});

router.post('/:id/clone', requirePermission('system:rbac:write'), async (req, res) => {
  const body = z.object({ key: z.string(), label: z.string() }).parse(req.body);
  const clone = await req.app.locals.roleService.clone(req.params.id, body, req.auth!.userId);
  res.status(201).json({ data: clone });
});

export default router;
```

---

## 10. Angular Implementation

### 10.1 Module Layout

```
apps/admin/src/app/core/rbac/
├── models/
│   ├── permission.model.ts
│   ├── role.model.ts
│   ├── policy.model.ts
│   └── check.model.ts
├── services/
│   ├── rbac.service.ts                  # Facade
│   ├── permission.service.ts            # Check API
│   ├── role.service.ts                  # Role CRUD
│   ├── user-role.service.ts             # Assignment
│   └── audit-log.service.ts
├── guards/
│   ├── permission.guard.ts
│   ├── role.guard.ts
│   └── feature.guard.ts
├── directives/
│   ├── has-permission.directive.ts      # *hasPermission
│   ├── has-role.directive.ts            # *hasRole
│   └── has-feature.directive.ts         # *hasFeature
├── interceptors/
│   └── policy-version.interceptor.ts    # auto-refresh on version drift
├── store/
│   └── policy.store.ts                  # Signal-based state
└── index.ts
```

### 10.2 Models

```ts
// apps/admin/src/app/core/rbac/models/permission.model.ts
export type PermissionType = 'feature' | 'screen' | 'component' | 'action' | 'database';
export type PermissionEffect = 'allow' | 'deny';

export interface Permission {
  id: string;
  key: string;
  type: PermissionType;
  label: string;
  description?: string;
  groupId?: string;
  isSystem?: boolean;
}

export interface PermissionGroup {
  id: string;
  key: string;
  label: string;
  icon?: string;
  sortOrder: number;
  permissions?: Permission[];
}
```

```ts
// apps/admin/src/app/core/rbac/models/role.model.ts
export interface Role {
  id: string;
  organizationId?: string | null;     // null = system role
  key: string;
  label: string;
  description?: string;
  level: number;
  isSystem: boolean;
  color?: string;
  metadata?: Record<string, any>;
  permissions?: RolePermission[];
  inheritsFrom?: Role[];
}

export interface RolePermission {
  permissionKey: string;
  effect: PermissionEffect;
}

export interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  organizationId: string;
  resourceType?: string;
  resourceId?: string;
  status: 'active' | 'suspended' | 'expired';
  validFrom: string;
  validUntil?: string;
}
```

```ts
// apps/admin/src/app/core/rbac/models/policy.model.ts
export interface EffectivePolicy {
  userId: string;
  orgId: string;
  version: number;
  allowed: string[];
  denied: string[];
  roles: { id: string; key: string; label: string }[];
  resolvedAt: number;
}

export interface CheckResult {
  permission: string;
  allowed: boolean;
  source: 'role' | 'inherited' | 'override' | 'deny' | null;
}
```

### 10.3 Policy Store (Signals)

```ts
// apps/admin/src/app/core/rbac/store/policy.store.ts
import { Injectable, computed, signal } from '@angular/core';
import { EffectivePolicy } from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class PolicyStore {
  private readonly _policy = signal<EffectivePolicy | null>(null);
  private readonly _loading = signal(false);

  readonly policy = this._policy.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly allowedSet = computed(() => new Set(this._policy()?.allowed ?? []));
  readonly deniedSet  = computed(() => new Set(this._policy()?.denied ?? []));
  readonly version    = computed(() => this._policy()?.version ?? 0);

  setPolicy(p: EffectivePolicy) { this._policy.set(p); }
  clear() { this._policy.set(null); }
}
```

### 10.4 Permission Service

```ts
// apps/admin/src/app/core/rbac/services/permission.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolicyStore } from '../store/policy.store';
import { CheckResult } from '../models/check.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private store = inject(PolicyStore);

  /** Reactive signal: can the current user perform this action? */
  can = (permission: string) => computed(() => {
    const policy = this.store.policy();
    if (!policy) return false;
    if (policy.denied.includes(permission)) return false;
    return policy.allowed.includes(permission) ||
           policy.allowed.some(k => this.matchGlob(k, permission));
  });

  /** Imperative sync check (for hot paths / template teardown) */
  canSync(permission: string): boolean {
    const policy = this.store.policy();
    if (!policy) return false;
    if (policy.denied.includes(permission)) return false;
    return policy.allowed.includes(permission) ||
           policy.allowed.some(k => this.matchGlob(k, permission));
  }

  canAll(permissions: string[]): boolean {
    return permissions.every(p => this.canSync(p));
  }

  canAny(permissions: string[]): boolean {
    return permissions.some(p => this.canSync(p));
  }

  hasRole(roleKey: string): boolean {
    return this.store.policy()?.roles.some(r => r.key === roleKey) ?? false;
  }

  /** Reload full policy from server (called on login, tenant switch, version drift) */
  async refreshPolicy(): Promise<void> {
    const policy = await firstValueFrom(
      this.http.get<EffectivePolicy>('/api/v1/rbac/me/policy')
    );
    this.store.setPolicy(policy);
  }

  /** Server-side bulk check (uses local cache when possible) */
  async checkMany(permissions: string[]): Promise<CheckResult[]> {
    const { results } = await firstValueFrom(
      this.http.post<{ results: CheckResult[] }>('/api/v1/rbac/check', { checks: permissions })
    );
    return results;
  }

  private matchGlob(pattern: string, key: string): boolean {
    if (!pattern.includes('*')) return false;
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test(key);
  }
}
```

### 10.5 RBAC Service (Facade)

```ts
// apps/admin/src/app/core/rbac/services/rbac.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Role, RolePermission } from '../models/role.model';
import { Permission } from '../models/permission.model';
import { PolicyStore } from '../store/policy.store';
import { PermissionService } from './permission.service';

@Injectable({ providedIn: 'root' })
export class RbacService {
  private http = inject(HttpClient);
  private store = inject(PolicyStore);
  private perms = inject(PermissionService);

  // ---- Permissions ----
  listPermissions(filter?: { type?: string; groupId?: string }) {
    return firstValueFrom(
      this.http.get<{ data: Permission[] }>('/api/v1/rbac/permissions', { params: filter as any })
    );
  }

  // ---- Roles ----
  listRoles() {
    return firstValueFrom(this.http.get<{ data: Role[] }>('/api/v1/rbac/roles'));
  }

  getRole(id: string) {
    return firstValueFrom(this.http.get<{ data: Role }>(`/api/v1/rbac/roles/${id}`));
  }

  createRole(input: Partial<Role> & { inheritsFrom?: string[]; permissions?: RolePermission[] }) {
    return firstValueFrom(this.http.post<{ data: Role }>('/api/v1/rbac/roles', input));
  }

  updateRole(id: string, patch: Partial<Role>) {
    return firstValueFrom(this.http.patch<{ data: Role }>(`/api/v1/rbac/roles/${id}`, patch));
  }

  deleteRole(id: string) {
    return firstValueFrom(this.http.delete(`/api/v1/rbac/roles/${id}`));
  }

  setRolePermissions(id: string, permissions: RolePermission[]) {
    return firstValueFrom(
      this.http.put(`/api/v1/rbac/roles/${id}/permissions`, { permissions })
    );
  }

  setRoleInheritance(id: string, parentIds: string[]) {
    return firstValueFrom(
      this.http.put(`/api/v1/rbac/roles/${id}/inheritance`, { parents: parentIds })
    );
  }

  cloneRole(id: string, key: string, label: string) {
    return firstValueFrom(this.http.post<{ data: Role }>(`/api/v1/rbac/roles/${id}/clone`, { key, label }));
  }

  // ---- User assignments ----
  assignRole(userId: string, roleId: string, options?: { resourceType?: string; resourceId?: string; validUntil?: string }) {
    return firstValueFrom(
      this.http.post(`/api/v1/rbac/users/${userId}/roles`, { roleId, ...options })
    );
  }

  revokeRole(userId: string, assignmentId: string) {
    return firstValueFrom(
      this.http.delete(`/api/v1/rbac/users/${userId}/roles/${assignmentId}`)
    );
  }

  // ---- Convenience ----
  can = (perm: string) => this.perms.can(perm);
  canSync = (perm: string) => this.perms.canSync(perm);
}
```

---

## 11. Dynamic UI Authorization

### 11.1 `*hasPermission` Directive

```ts
// apps/admin/src/app/core/rbac/directives/has-permission.directive.ts
import {
  Directive, Input, TemplateRef, ViewContainerRef, inject, effect,
  signal, OnInit, OnDestroy
} from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { PolicyStore } from '../store/policy.store';

@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private tpl  = inject(TemplateRef);
  private vcr  = inject(ViewContainerRef);
  private perms = inject(PermissionService);
  private store = inject(PolicyStore);

  private required = signal<string[]>([]);
  private mode: 'any' | 'all' = 'all';
  private viewRef: any = null;

  @Input() set hasPermission(value: string | string[]) {
    this.required.set(Array.isArray(value) ? value : [value]);
  }
  @Input() set hasPermissionMode(m: 'any' | 'all') { this.mode = m; }

  constructor() {
    // Re-evaluate whenever policy changes
    effect(() => {
      this.store.version();      // track
      this.evaluate();
    });
  }

  ngOnInit() { this.evaluate(); }
  ngOnDestroy() { this.vcr.clear(); }

  private evaluate() {
    const perms = this.required();
    const ok = this.mode === 'all'
      ? this.perms.canAll(perms)
      : this.perms.canAny(perms);

    if (ok && !this.viewRef) {
      this.viewRef = this.vcr.createEmbeddedView(this.tpl);
    } else if (!ok && this.viewRef) {
      this.vcr.clear();
      this.viewRef = null;
    }
  }
}
```

Usage:
```html
<button *hasPermission="'users:user:delete'" (click)="delete(user)">Delete</button>
<div   *hasPermission="['users:user:read', 'users:role:read']; mode: 'all'">…</div>
<button *hasPermission="['users:user:edit','users:user:delete']; mode: 'any'">Modify</button>
```

### 11.2 `*hasRole` Directive

```ts
@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective {
  private tpl  = inject(TemplateRef);
  private vcr  = inject(ViewContainerRef);
  private perms = inject(PermissionService);
  private store = inject(PolicyStore);
  private required = signal<string[]>([]);
  private viewRef: any = null;

  @Input() set hasRole(value: string | string[]) {
    this.required.set(Array.isArray(value) ? value : [value]);
  }

  constructor() {
    effect(() => {
      this.store.version();
      this.evaluate();
    });
  }

  private evaluate() {
    const ok = this.required().some(r => this.perms.hasRole(r));
    if (ok && !this.viewRef) this.viewRef = this.vcr.createEmbeddedView(this.tpl);
    else if (!ok && this.viewRef) { this.vcr.clear(); this.viewRef = null; }
  }
}
```

### 11.3 `*hasFeature` Directive (for module toggles)
```ts
@Directive({ selector: '[hasFeature]', standalone: true })
export class HasFeatureDirective {
  private tpl  = inject(TemplateRef);
  private vcr  = inject(ViewContainerRef);
  private perms = inject(PermissionService);
  private store = inject(PolicyStore);
  private required = signal<string>('');
  private viewRef: any = null;

  @Input() set hasFeature(value: string) { this.required.set(value); }

  constructor() {
    effect(() => {
      this.store.version();
      const ok = this.perms.canSync(`feature:${this.required()}`);
      if (ok && !this.viewRef) this.viewRef = this.vcr.createEmbeddedView(this.tpl);
      else if (!ok && this.viewRef) { this.vcr.clear(); this.viewRef = null; }
    });
  }
}
```

### 11.4 Policy-Version Interceptor

If the server returns a `policy_version` in a response header different from the client's cached version, the interceptor triggers a refresh:

```ts
@Injectable()
export class PolicyVersionInterceptor implements HttpInterceptor {
  private store = inject(PolicyStore);
  private perms = inject(PermissionService);

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          const serverVersion = event.headers.get('X-Policy-Version');
          const localVersion = this.store.version();
          if (serverVersion && +serverVersion > localVersion) {
            this.perms.refreshPolicy();
          }
        }
      })
    );
  }
}
```

---

## 12. Route Guards

### 12.1 Permission Guard (most common)

```ts
// apps/admin/src/app/core/rbac/guards/permission.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { PolicyStore } from '../store/policy.store';

export const permissionGuard = (key: string): CanMatchFn =>
  () => {
    const perms = inject(PermissionService);
    const store = inject(PolicyStore);
    const router = inject(Router);

    if (!store.policy()) {
      return router.createUrlTree(['/auth/login']);
    }
    return perms.canSync(key) ? true : router.createUrlTree(['/403']);
  };
```

### 12.2 Role-Level Guard (for hard hierarchies)

```ts
export const roleGuard = (minLevel: number): CanMatchFn =>
  () => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    // Compute max level from current user's roles
    const userMaxLevel = Math.max(0, ...(/* pull from store */) []);
    return userMaxLevel >= minLevel ? true : router.createUrlTree(['/403']);
  };
```

### 12.3 Feature Guard

```ts
export const featureGuard = (feature: string): CanMatchFn =>
  () => {
    const perms = inject(PermissionService);
    return perms.canSync(`feature:${feature}`) ? true : inject(Router).createUrlTree(['/403']);
  };
```

### 12.4 Route Configuration

```ts
// apps/admin/src/app/app.routes.ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/dashboard/dashboard.component') },

  { path: 'admin/users',
    canMatch: [permissionGuard('screen:admin.users.list')],
    loadComponent: () => import('./features/admin/users/users-list.component')
  },
  { path: 'admin/users/:id',
    canMatch: [permissionGuard('screen:admin.users.detail')],
    loadComponent: () => import('./features/admin/users/user-detail.component')
  },

  { path: 'admin/billing',
    canMatch: [featureGuard('billing')],
    loadComponent: () => import('./features/admin/billing/billing.component')
  },

  { path: 'admin/audit',
    canMatch: [permissionGuard('screen:admin.audit')],
    loadChildren: () => import('./features/admin/audit/audit.routes')
  },

  { path: '403', loadComponent: () => import('./features/errors/forbidden.component') }
];
```

---

## 13. Audit Logging

### 13.1 What Gets Logged

| Category | Examples | Storage |
|----------|----------|---------|
| **Auth events** | login, logout, refresh, mfa-challenge | `audit_logs` |
| **Permission checks (deny only)** | `permission.deny` with context | `audit_logs` (sampled 100%) |
| **Role mutations** | role.create, role.update, role.delete | `audit_logs` |
| **Assignment changes** | user_role.assign, user_role.revoke | `audit_logs` |
| **Permission grants** | role_permission.grant, role_permission.revoke | `audit_logs` |
| **Inheritance changes** | role_inheritance.add, role_inheritance.remove | `audit_logs` |
| **Bulk ops** | `users.bulk_assign` with affected count | `audit_logs` |
| **Admin actions** | impersonate, export | `audit_logs` |

### 13.2 Hash Chain (Tamper-Evidence)

Each row contains `hash = sha256(prev_hash || serialized_row)`. The first row's `prev_hash` is the org's seed. Any retroactive edit breaks the chain — verifiable by a daily job.

```ts
async function appendLog(entry: AuditEntry) {
  const prev = await db.audit_logs.findFirst({
    where: { organization_id: entry.orgId },
    orderBy: { id: 'desc' },
    select: { hash: true }
  });
  const prevHash = prev?.hash ?? entry.orgSeed;
  const payload = JSON.stringify({ ...entry, prev_hash: prevHash });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return db.audit_logs.create({ data: { ...entry, prev_hash: prevHash, hash } });
}
```

### 13.3 Async Pipeline
- API enqueues an `audit` job (BullMQ on Redis).
- Worker batches up to 100 entries / 1 s.
- Failed writes retry with exponential backoff (max 5).
- Critical events (deny, login) flush synchronously before responding.

### 13.4 Retention
- Hot: 90 days in primary DB, indexed.
- Cold: archived to S3 / Supabase Storage, partitioned by month.
- Compliance-driven (SOC2: 1 year; HIPAA: 6 years).

---

## 14. UI Permission Management

### 14.1 Screen Layouts

#### 14.1.1 Role List (`/admin/roles`)
```
┌──────────────────────────────────────────────────────────────┐
│ Roles                                          [+ New Role]  │
├──────────────────────────────────────────────────────────────┤
│ [Search ____] [Type ▾] [Sort: Level ▾]                       │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🛡  Super Admin        system · level 100  [system] [⋯]  │ │
│ │ 👑 Org Owner          org    · level 90   [system] [⋯]  │ │
│ │ ⚙️  Org Admin          org    · level 80                │ │
│ │ 🧑‍💼 Manager            org    · level 60                │ │
│ │ 🎯 HR                 org    · level 50   ← inherits Mgr│ │
│ │ 👨‍💻 Developer          org    · level 40                │ │
│ │ ✏️  Editor             org    · level 30   ← inherits Vw│ │
│ │ 👁  Viewer             org    · level 10                │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 14.1.2 Role Editor (`/admin/roles/:id`)
```
┌──────────────────────────────────────────────────────────────┐
│  Edit Role: HR                                    [Save]     │
├──────────────────────────────────────────────────────────────┤
│ Key: hr   Label: HR   Level: 50   Color: 🟣                  │
│                                                              │
│  Inherits From                                               │
│  ─────────────                                               │
│   ☑ Manager                                                  │
│   ☐ Org Admin                                                │
│   ☐ Org Owner                                                │
│                                                              │
│  Permissions (12 granted · 0 denied)         [Filter ▾]      │
│  ┌─ User Management ─────────────────────────────────────┐  │
│  │  ☑ users:user:read          ALLOW (Manager)            │  │
│  │  ☑ users:user:create        ALLOW (this role)          │  │
│  │  ☐ users:user:delete        DENY  (explicit)            │  │
│  │  ☐ users:user:impersonate   —                          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ Recruitment ──────────────────────────────────────────┐  │
│  │  ☑ candidates:application:read                          │  │
│  │  ☑ candidates:application:create                       │  │
│  │  ☐ candidates:offer:approve                             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 14.1.3 User Detail with Roles (`/admin/users/:id`)
```
┌──────────────────────────────────────────────────────────────┐
│  Jane Doe   jane@acme.com                                    │
│  ───────────────────────                                     │
│  Effective Policy Version: 17          [Last refresh 2m ago] │
│                                                              │
│  Roles (2)                                    [+ Assign Role] │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ HR          active     since 2024-01-15   [⋯]          │  │
│  │ Recruiter   active     since 2025-03-02   [⋯]          │  │
│  │ Manager     suspended  2025-04-10 14:22   [⋯]          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Direct Permission Overrides (1)         [+ Add Override]    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ reports:report:export   ALLOW  until 2026-12-31   [⋯]  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [View Effective Permissions]   [View Audit Log]             │
└──────────────────────────────────────────────────────────────┘
```

### 14.2 Components Required
- `role-list`, `role-detail`, `role-edit-form`
- `permission-matrix` (grouped checkboxes)
- `inheritance-graph` (DAG visualizer — `d3` or `cytoscape.js`)
- `user-role-assignment`, `direct-permission-list`
- `audit-log-table` with filters, export, hash-verify button

---

## 15. Security Model

### 15.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Privilege escalation** via role mutation | `role.create` / `role.write` requires `system:rbac:write`; super-admin protected by `is_system=true` |
| **Forced browsing** past UI guards | Server-side re-check on every endpoint; UI hiding is cosmetic only |
| **JWT replay** | Short-lived access (15 min), refresh rotation, session binding |
| **Cache poisoning** | Policy version pinning in JWT; server re-validates |
| **Audit log tampering** | Hash chain + daily verification job |
| **IDOR** | Database permission scopes + RLS; `db:<table>:row.read.own` |
| **Mass assignment** on role update | Zod schemas whitelist fields |
| **Privilege inheritance cycle** | DB trigger + app-level check |
| **Token theft via XSS** | HttpOnly cookies; Angular innerHTML sanitization |
| **CSRF** | SameSite=strict cookies + double-submit token for state-changing |
| **BOLA** (broken object-level authz) | Resource-scope engine applied in query builder |
| **DoS via deep inheritance** | Max depth 8, validated at link time |

### 15.2 Defense in Depth

```
Layer 1: Network  ── WAF, rate-limit, IP allowlist for admin
Layer 2: Auth     ── JWT verify, MFA for sensitive ops
Layer 3: Authz    ── Permission Engine on every endpoint (req:perm)
Layer 4: Query    ── Resource scopes injected into query builder
Layer 5: DB       ── RLS policies as last-resort
Layer 6: Audit    ── Hash-chained log of every decision
```

### 15.3 Hybrid RBAC + ABAC
For v1, ABAC is limited to:
- **Resource scopes** (`own` / `team` / `department`)
- **Time-bound grants** (`valid_until`)
- **Tenant isolation** (mandatory `organization_id` predicate)

Full attribute expressions (e.g. `"record.department == user.department"`) deferred to v2.

### 15.4 Sensitive Operations — Step-Up Auth
Mutations to system roles or impersonation require a fresh MFA challenge within the last 5 min. JWT carries `mfa_age` claim; server enforces.

### 15.5 Secrets Handling
- JWT keys: AWS KMS / Supabase Vault.
- Cache keys: never contain plaintext permission data without encryption.
- No permission strings in error messages that leak keys to non-admins.

---

## 16. Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| `resolvePermissions` (cold) | < 50 ms p95 | API trace |
| `resolvePermissions` (L1 hit) | < 1 ms p95 | API trace |
| `resolvePermissions` (L2 hit) | < 5 ms p95 | API trace |
| `check` (single perm) | < 2 ms p95 | API trace |
| `checkMany` (10 perms) | < 10 ms p95 | API trace |
| Policy re-resolve on login | < 100 ms p95 | Integration test |
| DAG expansion (10 roles) | < 1 ms | Unit test |
| Angular `can()` signal eval | < 0.1 ms | Browser profile |
| Audit log write (async) | < 50 ms enqueue | Trace |
| Cache eviction on policy change | < 1 s global | Health check |

---

## 17. Migration & Seed Plan

### 17.1 Migration Files (in order)

```
apps/backend/supabase/migrations/
├── 001_auth_tenants.sql                  # existing
├── 002_rbac_core.sql                     # roles, permissions, groups
├── 003_rbac_inheritance.sql              # role_inheritance + trigger
├── 004_rbac_assignments.sql              # user_roles, user_permissions
├── 005_rbac_scopes.sql                   # resource_scopes
├── 006_rbac_audit.sql                    # audit_logs + hash chain fn
├── 007_rbac_policy_version.sql           # policy_versions + bump triggers
└── 008_rbac_rls_policies.sql             # row-level security
```

### 17.2 Seed: Default System Permissions

```sql
-- Permission groups
INSERT INTO permission_groups (key, label, sort_order) VALUES
  ('user_management', 'User Management', 10),
  ('content', 'Content & CMS', 20),
  ('billing', 'Billing & Plans', 30),
  ('analytics', 'Analytics', 40),
  ('security', 'Security & Audit', 50),
  ('system', 'System', 60);

-- Action permissions
INSERT INTO permissions (key, type, label, group_id) VALUES
  ('users:user:create', 'action', 'Create User', 'user_management'),
  ('users:user:read',   'action', 'Read User',   'user_management'),
  ('users:user:update', 'action', 'Update User', 'user_management'),
  ('users:user:delete', 'action', 'Delete User', 'user_management'),
  ('users:role:create', 'action', 'Create Role', 'user_management'),
  ('users:role:read',   'action', 'Read Role',   'user_management'),
  ('users:role:update', 'action', 'Update Role', 'user_management'),
  ('users:role:delete', 'action', 'Delete Role', 'user_management'),
  ('system:rbac:read',  'action', 'Read RBAC Config', 'security'),
  ('system:rbac:write', 'action', 'Write RBAC Config', 'security'),
  ('system:audit:read', 'action', 'Read Audit Logs', 'security'),
  ('system:impersonate','action', 'Impersonate User', 'security'),
  -- Feature permissions
  ('feature:analytics','feature','Analytics Module', 'analytics'),
  ('feature:billing',  'feature','Billing Module',   'billing'),
  ('feature:reports',  'feature','Reports Module',   'analytics'),
  -- Screen permissions
  ('screen:admin.dashboard','screen','Admin Dashboard', 'system'),
  ('screen:admin.users.list','screen','Users List',    'user_management'),
  ('screen:admin.users.detail','screen','User Detail', 'user_management'),
  ('screen:admin.roles','screen','Roles Page',        'user_management'),
  ('screen:admin.audit','screen','Audit Page',        'security');
```

### 17.3 Seed: Default System Roles

```sql
-- Super Admin — all permissions
INSERT INTO roles (organization_id, key, label, level, is_system, color)
VALUES (NULL, 'super_admin', 'Super Admin', 100, true, '#ef4444');

INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'
FROM roles r CROSS JOIN permissions p
WHERE r.key = 'super_admin';

-- Org Admin
INSERT INTO roles (organization_id, key, label, level, is_system, color)
VALUES (NULL, 'org_admin', 'Org Admin', 80, true, '#f59e0b');

-- (subsequent roles: manager, hr, finance, developer, support, recruiter, editor, viewer, client_admin)
```

### 17.4 Seed: Hierarchy

```sql
INSERT INTO role_inheritance (role_id, parent_role_id)
SELECT child.id, parent.id
FROM roles child JOIN roles parent ON (
  (child.key = 'org_admin'  AND parent.key = 'super_admin') OR
  (child.key = 'manager'     AND parent.key = 'org_admin')  OR
  (child.key = 'hr'          AND parent.key = 'manager')    OR
  (child.key = 'finance'     AND parent.key = 'manager')    OR
  (child.key = 'developer'   AND parent.key = 'manager')    OR
  (child.key = 'support'     AND parent.key = 'manager')    OR
  (child.key = 'recruiter'   AND parent.key = 'hr')         OR
  (child.key = 'editor'      AND parent.key = 'org_admin')  OR
  (child.key = 'viewer'      AND parent.key = 'editor')
);
```

### 17.5 Per-Tenant Bootstrap
On new organization creation, the backend runs a transaction:
1. Clone system roles (with `organization_id` set).
2. Clone role inheritance graph.
3. Assign `org_owner` role to the creator.

---

## 18. Testing Strategy

| Layer | Test | Tools |
|-------|------|-------|
| **Engine** | Resolution correctness, cycle detection, deny-wins | Jest unit |
| **Cache** | Hit/miss, invalidation, stampede | Jest + sinon fake timers |
| **API** | CRUD, permission denial, audit emission | Supertest |
| **RBAC at DB** | RLS policies, triggers | pgTAP / raw SQL |
| **Angular services** | Signal reactivity, cache | Karma + Jasmine |
| **Guards / directives** | Render / redirect paths | Playwright |
| **E2E** | Full user flow with role mutation | Playwright |
| **Perf** | p95 budgets, 1000 RPS for 5 min | k6 |
| **Security** | IDOR, privilege escalation, hash-chain | OWASP ZAP + custom |

### 18.1 Property-Based Tests
- Random role graphs → resolve must terminate, no cycles, deterministic.
- Random permission sets → DENY always overrides ALLOW.
- Cache invalidation: every policy mutation must bump version.

---

## 19. Operational Runbook

### 19.1 Adding a New Permission
1. INSERT into `permissions` (label, type, group).
2. Bump `policy_versions` for affected orgs.
3. Notify: admin UI auto-reflects on next user request.
4. No code deploy needed if permission string follows convention.

### 19.2 Adding a New Role
1. Admin creates role via UI (`POST /api/v1/rbac/roles`).
2. Set inheritance parents.
3. Assign permissions.
4. Engine re-resolves for all affected users within 60 s (L1) or instantly (L2 invalidation).

### 19.3 Cache Storm Recovery
If Redis dies, the system falls back to L1 + DB. Expect 5-10× DB load; auto-scales worker pool.

### 19.4 Audit Hash Verification (Daily Job)
```sql
WITH last_per_org AS (
  SELECT DISTINCT ON (organization_id) id, hash
  FROM audit_logs
  ORDER BY organization_id, id DESC
)
SELECT organization_id, hash, created_at FROM last_per_org;
```
Compare with a known-good snapshot; alert on mismatch.

### 19.5 Incident: Suspected Tampering
1. Stop accepting writes (read-only mode).
2. Run hash chain verification across orgs.
3. Restore from S3 cold archive (if needed).
4. Rotate JWT signing keys.

---

## Appendix A — Default Role × Permission Matrix

| Permission | Super | Org Owner | Org Admin | Manager | HR | Finance | Dev | Support | Recruiter | Editor | Viewer |
|------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| users:user:create | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| users:user:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| users:user:update | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | – |
| users:user:delete | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| users:role:write | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| system:rbac:read | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| system:audit:read | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| feature:analytics | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – |
| feature:billing | ✓ | ✓ | ✓ | – | – | ✓ | – | – | – | – | – |
| feature:reports | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – | – |
| content:post:publish | ✓ | ✓ | ✓ | – | – | – | – | – | – | ✓ | – |
| content:post:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| candidates:application:create | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | – |
| candidates:offer:approve | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – | – | – |
| screen:admin.users.list | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| screen:admin.audit | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |

> (✓ = ALLOW · – = not granted by default; admins can add via UI)

---

## Appendix B — Default Role Hierarchy

```
                        Super Admin (system, level 100)
                                │
                          Org Owner (level 90, system)
                                │
                          Org Admin (level 80, system)
                                │
                ┌───────────────┼───────────────┐
              Manager         Editor         Client Admin
              (60)            (30)            (per-org)
           ┌────┼────┐           │
           │    │    │        Viewer
          HR  Fin  Dev         (10)
          50   50   40
           │
       Recruiter
          (45)

  Support (35) — inherits Manager
```

---

## Appendix C — Glossary of Permission Keys

| Domain | Pattern | Example |
|--------|---------|---------|
| `users` | `users:<entity>:<action>` | `users:user:create` |
| `roles` | `roles:role:<action>` | `roles:role:assign` |
| `content` | `content:<entity>:<action>` | `content:post:publish` |
| `candidates` | `candidates:<entity>:<action>` | `candidates:application:create` |
| `billing` | `billing:<entity>:<action>` | `billing:invoice:read` |
| `analytics` | `analytics:<entity>:<action>` | `analytics:report:export` |
| `system` | `system:<area>:<action>` | `system:rbac:write` |
| `feature` | `feature:<module>` | `feature:analytics` |
| `screen` | `screen:<route>` | `screen:admin.users.list` |
| `component` | `component:<id>` | `component:user.deleteBtn` |
| `db` | `db:<table>:<scope>.<verb>` | `db:projects:row.read.own` |

---

**End of Document**

See also:
- `rbac-architecture.html` — visual diagram
- `RBAC_QUICK_REFERENCE.md` — operator cheatsheet
- `apps/backend/supabase/migrations/002_rbac_*.sql` — SQL migrations
- `apps/backend/src/rbac/` — backend implementation
- `apps/admin/src/app/core/rbac/` — Angular implementation
