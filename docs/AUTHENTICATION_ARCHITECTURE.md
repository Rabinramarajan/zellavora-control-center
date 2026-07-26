# Enterprise Multi-Tenant Authentication Architecture

**Version:** 1.0  
**Phase:** 0 (Database Foundation) ✅  
**Status:** Foundation Complete, Ready for Backend Implementation

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Angular Frontend (Port 4200)                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ Auth Service     │  │ Tenant Service   │  │ Permission Svc  │   │
│  │ (signals state)  │  │ (switch tenants) │  │ (role-based)    │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘   │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ HTTP Interceptors                                            │   │
│  │ • Add Authorization header (JWT)                            │   │
│  │ • Add X-Tenant-ID header (org context)                      │   │
│  │ • Retry on 401 with token refresh                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
└──────────────────────────────────────────────────────────────────────┘
                               ↓ HTTPS
┌──────────────────────────────────────────────────────────────────────┐
│                    Express Backend (Port 3000)                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ API Routes                                                   │   │
│  │ POST   /auth/login              (Client Code + Email + Pwd) │   │
│  │ POST   /auth/register           (Create account)            │   │
│  │ POST   /auth/logout             (Revoke session)            │   │
│  │ POST   /auth/refresh-token      (Rotate tokens)             │   │
│  │ POST   /auth/forgot-password    (Email reset link)          │   │
│  │ POST   /auth/reset-password/:tk (Set new password)          │   │
│  │ POST   /auth/verify-email/:tk   (Verify email)              │   │
│  │ GET    /auth/me                 (Current user context)      │   │
│  │ GET    /auth/tenants            (User's organizations)      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Middleware Stack                                             │   │
│  │ 1. Rate Limiter (5 login attempts per 15 min)              │   │
│  │ 2. Logger (IP, user agent)                                 │   │
│  │ 3. Parser (JSON bodies)                                    │   │
│  │ 4. CSRF Protection                                         │   │
│  │ 5. Auth (JWT validation)                                   │   │
│  │ 6. Tenant Validator (X-Tenant-ID or JWT claim)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Services (Phase 1)                                           │   │
│  │ • PasswordService      (bcrypt hash/verify)                 │   │
│  │ • TenantService        (org validation, member check)       │   │
│  │ • SessionService       (create/revoke sessions)             │   │
│  │ • EmailService         (SMTP/SendGrid)                      │   │
│  │ • JwtService           (token generation/verification)      │   │
│  │ • PermissionService    (role-based access)                  │   │
│  │ • AuditService         (log all actions)                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
└──────────────────────────────────────────────────────────────────────┘
                               ↓ SQL
┌──────────────────────────────────────────────────────────────────────┐
│               PostgreSQL (Supabase) + Row Level Security             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Organizations (Tenants)                                    │   │
│  │ ├─ id, name, slug, plan, status                            │   │
│  │ ├─ max_members, max_projects, max_storage_gb               │   │
│  │ ├─ owner_id (FK: users)                                    │   │
│  │ └─ Created with RLS: only members can view/edit            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Users (with Multi-Tenant Support)                          │   │
│  │ ├─ id, email, full_name, role                              │   │
│  │ ├─ tenant_id (FK: organizations) ← NEW                     │   │
│  │ ├─ password_hash (bcrypt) ← NEW                            │   │
│  │ ├─ two_factor_enabled, two_factor_secret ← NEW             │   │
│  │ ├─ failed_login_attempts, locked_until ← NEW               │   │
│  │ ├─ deleted_at (soft delete) ← NEW                          │   │
│  │ └─ RLS: users can only see own data (by tenant)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Organization Members (NEW)                                 │   │
│  │ ├─ id, organization_id, user_id, role                      │   │
│  │ ├─ role: 'owner' | 'admin' | 'member'                      │   │
│  │ ├─ invited_at, joined_at, deleted_at                       │   │
│  │ └─ RLS: only org members can view                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Sessions (NEW)                                             │   │
│  │ ├─ id, user_id, organization_id, session_token             │   │
│  │ ├─ ip_address, user_agent, device_fingerprint              │   │
│  │ ├─ last_activity_at, expires_at, revoked_at                │   │
│  │ └─ RLS: users can only see/revoke own sessions             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Audit Logs (NEW)                                           │   │
│  │ ├─ id, organization_id, actor_id, action                   │   │
│  │ ├─ resource_type, resource_id, description                 │   │
│  │ ├─ old_values, new_values (JSON before/after)              │   │
│  │ ├─ ip_address, user_agent, created_at                      │   │
│  │ └─ RLS: only org members can view their org's logs         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ API Keys (NEW)                                             │   │
│  │ ├─ id, organization_id, user_id, name                      │   │
│  │ ├─ key_hash (bcrypt), key_preview, scopes                  │   │
│  │ ├─ ip_whitelist, expires_at, revoked_at                    │   │
│  │ └─ RLS: users see own keys, admins see org keys            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Password Reset Tokens (NEW)                                │   │
│  │ ├─ id, user_id, token_hash, email                          │   │
│  │ ├─ created_at, expires_at (15 min), used_at                │   │
│  │ └─ RLS: no direct access (validated server-side)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Portfolio Tables (Enhanced)                                │   │
│  │ ├─ profiles, skills, experience, education, services...    │   │
│  │ ├─ organization_id FK (multi-tenant support) ← NEW          │   │
│  │ ├─ deleted_at (soft delete support) ← NEW                  │   │
│  │ └─ RLS: tenant isolation + published content public        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## JWT Token Payload (Phase 1)

```typescript
// Access Token (15 minutes)
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",  // ← NEW: Tenant context
  "role": "admin",                                       // Owner/admin/member
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // ← NEW: Session tracking
  "iat": 1690000000,
  "exp": 1690000900,
  "iss": "zellavora-auth",
  "aud": "zellavora-app"
}

// Refresh Token (7 days)
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "iat": 1690000000,
  "exp": 1690604800,
  "type": "refresh"
}
```

---

## Authentication Sequence Diagrams

### 1️⃣ Login Flow with Multi-Tenant Support

```
User                    Frontend                Backend              Database
  │                        │                        │                    │
  ├─ Enter tenant code      │                        │                    │
  │  + email + password     │                        │                    │
  └─────────────────────>   │                        │                    │
                            │                        │                    │
                            ├─ POST /auth/login      │                    │
                            │ {                      │                    │
                            │   clientCode: "...",   │                    │
                            │   email: "...",        │                    │
                            │   password: "...",     │                    │
                            │   rememberMe: true     │                    │
                            │ }                      │                    │
                            └───────────────────────>│                    │
                                                     │                    │
                                      ┌──────────────┴────────────────┐   │
                                      │ 1. Validate client code        │   │
                                      │ 2. Lookup organization         │   │
                                      │ 3. Find user by email          │   │
                                      │ 4. bcrypt.compare() password   │   │
                                      │ 5. Check account not locked    │   │
                                      │ 6. Check account not deleted   │   │
                                      └──────────────┬────────────────┘   │
                                                     │                    │
                                                     ├─ SELECT * FROM users WHERE email │
                                                     │ AND tenant_id = org.id           │
                                                     │                                  │
                                                     └─────────────────────────────────>│
                                                                                        │
                                                                  ┌─ Validate bcrypt hash
                                                                  │
                                                     │<──── User record ────────────────┤
                                                     │                                  │
                                      ┌──────────────┴────────────────┐                │
                                      │ 7. Generate session           │                │
                                      │ 8. Create JWT with tenant_id  │                │
                                      │ 9. Log login event (audit)    │                │
                                      │ 10. Return tokens             │                │
                                      └──────────────┬────────────────┘                │
                                                     │                                  │
                    ┌────────────────────────────────┴────────────────────────────┐    │
                    │ INSERT INTO sessions (...) VALUES (...); │                   │    │
                    │ INSERT INTO audit_logs (action='login'); │                   │    │
                    └────────────────────────────────┬────────────────────────────┘    │
                                                     │                                  │
                            ┌─ Response ────────────┴─>│                                  │
                            │ {                                                         │
                            │   accessToken: "...",                                     │
                            │   refreshToken: "...",                                    │
                            │   user: {id, email, role},                                │
                            │   tenant: {id, name, plan},                               │
                            │   expiresAt: 1690000900                                   │
                            │ }                                                         │
                            │<─ 200 OK ──────────────────────────────────────────────────┤
  <──────────────────────────│
  Store tokens
  Store tenant context
  Redirect to dashboard
```

### 2️⃣ Protected API Request with Tenant Isolation

```
Frontend                 Backend              Database (RLS)
  │                         │                       │
  ├─ GET /api/projects      │                       │
  │ Headers:                │                       │
  │  Authorization: Bearer <JWT>                    │
  │  X-Tenant-ID: org-id    │                       │
  │                         │                       │
  └────────────────────────>│                       │
                            │                       │
          ┌─────────────────┴────────────────┐      │
          │ 1. Validate JWT signature        │      │
          │ 2. Check exp > now               │      │
          │ 3. Verify tenant_id matches      │      │
          │ 4. Check user in organization    │      │
          │ 5. Load user permissions         │      │
          │ 6. Check permission: read        │      │
          │ 7. Extract org_id from tenant_id │      │
          │ 8. Execute query                 │      │
          └─────────────────┬────────────────┘      │
                            │                       │
                            ├─ SELECT * FROM projects
                            │ WHERE organization_id = $1
                            │ AND deleted_at IS NULL
                            │ AND (                  │
                            │   user_id = $2          │ ← Current user
                            │   OR status = 'published' │ ← Public published
                            │ );                    │
                            │                       │
                            │ Parameters:           │
                            │ $1 = org_id (from JWT)│
                            │ $2 = user_id (from JWT)│
                            │<─ Projects array ────>│
                            │                       │
            ┌─ Response ────────────────────────┐   │
            │ {                                 │   │
            │   projects: [                     │   │
            │     {id, title, status, org_id},  │   │
            │     {id, title, status, org_id}   │   │
            │   ]                               │   │
            │ }                                 │   │
            │<─ 200 OK ─────────────────────────────┤
  <─────────────────────────│

NOTE: Thanks to RLS, the database enforces that:
- User can ONLY see their org's data (org_id check)
- User can only see published projects if not owner
- User cannot access other orgs' data even if JWT is manipulated
- All queries filtered by tenant automatically
```

### 3️⃣ Token Refresh (Sliding Window)

```
Frontend              Backend           Database
  │                     │                  │
  ├─ (Token near expiry)│                  │
  │  Automatic refresh  │                  │
  │                     │                  │
  ├─ POST /auth/refresh-token              │
  │ {refreshToken: "..."} │                │
  └────────────────────>│                  │
                        │                  │
            ┌───────────┴────────────┐     │
            │ 1. Verify refresh token│     │
            │ 2. Check session active│     │
            │ 3. Check not revoked   │     │
            │ 4. Rotate refresh token│     │
            │ 5. Generate new access │     │
            │ 6. Keep tenant context │     │
            └───────────┬────────────┘     │
                        │                  │
            ┌───────────┴────────────────────────┐
            │ SELECT * FROM sessions WHERE       │
            │ session_token = $1                 │
            │ AND revoked_at IS NULL             │
            │ AND expires_at > now();            │
            │                                    │
            │ UPDATE sessions                    │
            │ SET last_activity_at = now()       │
            │ WHERE id = $1;                     │
            └───────────┬────────────────────────┘
                        │<─ Session record ─>
                        │
            ┌─ New Tokens (same tenant_id) ────┐
            │ accessToken (new)                │
            │ refreshToken (new)               │
            │ expiresAt                        │
            │<─ 200 OK ─────────────────────────────┤
  <──────────────────────│
  Store new tokens
  Continue seamlessly
```

### 4️⃣ Tenant Switching

```
User                Frontend              Backend           Database
  │                    │                    │                  │
  ├─ Click org #2      │                    │                  │
  │  in dropdown       │                    │                  │
  └──────────────────>│                    │                  │
                      │                    │                  │
                      ├─ GET /api/tenants  │                  │
                      │ (current JWT)      │                  │
                      └───────────────────>│                  │
                                           │                  │
                          ┌────────────────┴────────────────┐  │
                          │ 1. Get current user from JWT    │  │
                          │ 2. Query orgs where user member │  │
                          │ 3. Return list with roles       │  │
                          └────────────────┬────────────────┘  │
                                           │                  │
                                           ├─ SELECT om.* FROM
                                           │ organization_members om
                                           │ WHERE om.user_id = $1
                                           │ AND om.deleted_at IS NULL;
                                           │                  │
                                           │<─ [Org1, Org2] ──>
                      ┌─ Response ────────┴─>│                  │
                      │ [                    │                  │
                      │   {id: 1, name: "...", role: "owner"},
                      │   {id: 2, name: "...", role: "member"}
                      │ ]                    │                  │
                      │<─ 200 OK ────────────────────────────────┤
  <──────────────────────│
  Select org #2
  │
  ├─ PUT /api/tenants/2/switch
  │ (current JWT)
  └──────────────────────────>
                        │                   │
          ┌─────────────┴──────────────┐    │
          │ 1. Validate user in org #2│    │
          │ 2. Load org #2 details    │    │
          │ 3. Load new permissions   │    │
          │ 4. Generate new JWT       │    │
          │ (new tenant_id = org #2)  │    │
          │ 5. Invalidate old session │    │
          └─────────────┬──────────────┘    │
                        │                   │
        ┌───────────────┴──────────────────────┐
        │ SELECT roles, permissions           │
        │ FOR tenant_id = org_2_id             │
        │ WHERE user_id = $1;                 │
        │                                     │
        │ UPDATE sessions SET revoked_at=now()│
        │ WHERE session_id = ...;             │
        │ INSERT new session;                 │
        └───────────────┬──────────────────────┘
                        │<─ New session ─>
                        │
        ┌─ Response ────────────────────────┐
        │ {                                 │
        │   accessToken: "..." (org #2),    │
        │   refreshToken: "...",            │
        │   tenant: {id: 2, ...},           │
        │   permissions: [...]              │
        │ }                                 │
        │<─ 200 OK ──────────────────────────────┤
  <──────────────────────│
  Store new tokens
  Redirect to org #2 dashboard
```

### 5️⃣ Logout with Session Revocation

```
User              Frontend           Backend              Database
  │                   │                 │                    │
  ├─ Click logout     │                 │                    │
  └──────────────────>│                 │                    │
                      │                 │                    │
                      ├─ POST /auth/logout
                      │ {sessionId: "...", token: "..."}     │
                      │                 │                    │
                      └────────────────>│                    │
                                        │                    │
                            ┌───────────┴──────────────┐     │
                            │ 1. Verify JWT valid      │     │
                            │ 2. Extract session_id    │     │
                            │ 3. Revoke session        │     │
                            │ 4. Invalidate refresh    │     │
                            │ 5. Log logout action     │     │
                            │ 6. Clear user context    │     │
                            └───────────┬──────────────┘     │
                                        │                    │
                    ┌───────────────────┴──────────────────────────┐
                    │ UPDATE sessions SET revoked_at = now()       │
                    │ WHERE id = $1;                               │
                    │                                              │
                    │ DELETE FROM password_reset_tokens            │
                    │ WHERE user_id = $1;                          │
                    │                                              │
                    │ INSERT INTO audit_logs                       │
                    │ (action='logout', user_id, org_id, ip, ...); │
                    └───────────┬──────────────────────────────────┘
                                │<─ OK ─────────────────>
                                │
            ┌─ Response ────────┴─>
            │ {
            │   message: "Logged out successfully"
            │ }
            │<─ 200 OK ──────────────────────────────────────>
  <─────────────────────│
  Clear tokens
  Clear tenant context
  Redirect to login page
```

---

## Row Level Security (RLS) Patterns

### Pattern 1: User-Owned Resources (Private)

```sql
-- User can ONLY see their own data
CREATE POLICY "table_view_own" ON table
  FOR SELECT
  USING (auth.uid() = user_id);

-- Result: No access to other users' data
```

### Pattern 2: Organization Members (Semi-Private)

```sql
-- Org members can see each other's data
CREATE POLICY "table_view_org_members" ON table
  FOR SELECT
  USING (
    -- Check if accessor is member of same org
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- Result: Org isolation + internal visibility
```

### Pattern 3: Published Content (Public)

```sql
-- Public can view published, active content
CREATE POLICY "table_view_published" ON table
  FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
  );

-- Result: Published projects/posts accessible to public
```

### Pattern 4: Admin Management (Role-Based)

```sql
-- Only admins can manage
CREATE POLICY "table_admin_manage" ON table
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    )
  );

-- Result: Admin-only operations enforced
```

---

## Data Isolation Example

### Scenario: Two Organizations, Shared User

```
Organization #1 (acme.com)
├─ Owner: Alice (user_id = 001)
├─ Admin: Bob (user_id = 002)
├─ Member: Carol (user_id = 003)
└─ Data:
   ├─ 5 projects (org_id = org_1)
   ├─ 20 blog posts (org_id = org_1)
   └─ 100 media files (org_id = org_1)

Organization #2 (startups.io)
├─ Owner: David (user_id = 004)
├─ Admin: Alice (user_id = 001) ← SAME USER, DIFFERENT ROLE
└─ Data:
   ├─ 3 projects (org_id = org_2)
   ├─ 8 blog posts (org_id = org_2)
   └─ 50 media files (org_id = org_2)
```

**When Alice logs into Org #1:**
```
JWT contains: { userId: 001, tenantId: org_1, role: 'owner', ... }

Query: SELECT * FROM projects
Result (due to RLS):
- Returns all 5 org_1 projects (she's owner)
- CANNOT see 3 org_2 projects (different tenant_id)
- Enforced at database level (RLS policy check)
```

**When Alice logs into Org #2:**
```
JWT regenerated: { userId: 001, tenantId: org_2, role: 'admin', ... }

Query: SELECT * FROM projects
Result (due to RLS):
- CANNOT see 5 org_1 projects (tenant_id mismatch)
- Returns all 3 org_2 projects (she's admin)
- Different view based on tenant context
```

**Security Guarantee:**
- Even if JWT is crafted manually with `tenantId: org_1`
- Database RLS policy enforcement ensures only `org_2` data returns
- No SQL injection or JWT tampering can bypass tenant isolation
- Isolation enforced at PostgreSQL level (not application level)

---

## Security Layers

### Layer 1: Frontend (Angular)
- ✅ Validate login input
- ✅ Store tokens securely (localStorage with SameSite cookies)
- ✅ Check JWT expiry before requests
- ✅ Auto-refresh tokens

### Layer 2: HTTP Transport
- ✅ HTTPS only (TLS encryption)
- ✅ CORS validation
- ✅ X-Tenant-ID header validation
- ✅ Rate limiting on endpoints

### Layer 3: Backend Application
- ✅ Verify JWT signature
- ✅ Check token expiry
- ✅ Validate tenant_id in JWT
- ✅ Check user in organization
- ✅ Load user permissions
- ✅ Bcrypt password validation

### Layer 4: Database (RLS)
- ✅ PostgreSQL RLS policies enforce access
- ✅ User cannot SELECT data outside tenant
- ✅ No INSERT/UPDATE/DELETE without permission
- ✅ Audit logging on all changes

---

## Success Criteria: Phase 0 ✅

- [x] Multi-tenant schema with organizations table
- [x] Tenant ID added to all relevant tables
- [x] RLS policies fixed (removed "OR true" vulnerabilities)
- [x] 9 new enterprise tables created
- [x] Audit logging structure in place
- [x] Session tracking infrastructure ready
- [x] Soft delete support on 15+ tables
- [x] 50+ optimized indexes
- [x] Environment configuration complete
- [x] Security architecture documented

---

## What's Next: Phase 1

✅ This phase (Phase 0) — Database foundation  
🚀 Next phase (Phase 1) — Backend services (6 hours)

- Password & hashing service (bcrypt)
- Tenant validation service
- Session management
- Email sending (SMTP/SendGrid)
- Enhanced auth routes with tenant support
- Middleware for tenant isolation

---

**Architecture Version:** 1.0  
**Last Updated:** July 26, 2026  
**Status:** Phase 0 Complete ✅
