# RBAC Backend Module

Self-contained Role-Based Access Control for the ZCC backend.

## Mounting

```ts
// apps/backend/src/index.ts
import { buildRbac } from './rbac';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(process.env.REDIS_URL!);

const rbac = await buildRbac({ db, redis });

// Make services reachable from middleware
app.locals.engine = rbac.engine;
app.locals.audit = rbac.audit;
app.locals.roleService = rbac.roleService;
app.locals.userRoleService = rbac.userRoleService;

app.use('/api/v1/rbac', rbac.router);
```

## Layout

```
src/rbac/
├── engine/             # Resolution, DAG expansion, glob matcher
├── cache/              # L1 (LRU) + L2 (Redis) + invalidation
├── services/           # RoleService, UserRoleService, AuditService
├── controllers/        # Express routes
├── middleware/         # requirePermission, requireAny, requireAll
└── index.ts            # buildRbac() bootstrap
```

## Key Concepts

- **DENY wins** — every role can explicitly deny a permission it would otherwise inherit.
- **Policy version** — every mutation auto-bumps a per-tenant counter; cache key includes it, so caches self-invalidate.
- **Single-flight** — `setWithLock()` prevents thundering herd on cache miss.
- **Hash-chained audit** — every log row references the previous row's SHA-256, making tampering detectable.

## Performance

- `resolve()` (warm L1):  < 1 ms
- `resolve()` (warm L2):  < 5 ms
- `resolve()` (cold DB):  < 50 ms
- `checkMany(10)`:        < 10 ms
