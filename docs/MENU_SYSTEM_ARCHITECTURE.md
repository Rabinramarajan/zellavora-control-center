# Dynamic Menu System - Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ANGULAR FRONTEND                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              SidebarComponent                                 │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │     MenuComponent (Recursive)                          │  │  │
│  │  │  - Renders menu tree                                   │  │  │
│  │  │  - Handles expand/collapse                             │  │  │
│  │  │  - Emits itemSelected                                  │  │  │
│  │  │  - Emits favoriteToggled                               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────┐  ┌──────────┐  ┌──────────────┐             │  │
│  │  │  Favorites  │  │  Recent  │  │  User Menu   │             │  │
│  │  └─────────────┘  └──────────┘  └──────────────┘             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │          MenuService (Angular)                               │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ Signals:                                               │  │  │
│  │  │  • menuTree                                            │  │  │
│  │  │  • favorites                                           │  │  │
│  │  │  • recent                                              │  │  │
│  │  │  • categories                                          │  │  │
│  │  │  • isLoading                                           │  │  │
│  │  │  • error                                               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ Methods:                                               │  │  │
│  │  │  • loadMenuTree()      • toggleFavorite()              │  │  │
│  │  │  • getMenuById()       • trackMenuAccess()             │  │  │
│  │  │  • searchMenus()       • createMenu() [admin]          │  │  │
│  │  │  • getByCategory()     • updateMenu() [admin]          │  │  │
│  │  │  • getBreadcrumbs()    • deleteMenu() [admin]          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │      MenuCacheService (LRU Cache)                            │  │
│  │  - In-memory caching (100 entries)                           │  │
│  │  - TTL: 30 minutes                                           │  │
│  │  - Pattern-based invalidation                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           ▼                                        │
│           HTTP (REST API) with Caching Headers                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express.js)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Routes Layer (menus.ts)                                     │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ GET    /menus          │ POST   /menus              │   │  │
│  │  │ GET    /menus/:id      │ PUT    /menus/:id          │   │  │
│  │  │ GET    /menus/user/favorites                         │   │  │
│  │  │ GET    /menus/user/recent                            │   │  │
│  │  │ GET    /categories     │ DELETE /menus/:id          │   │  │
│  │  │ POST   /favorite       │ PATCH  /visibility         │   │  │
│  │  │ POST   /access         │ PATCH  /order              │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │  • Request validation (Zod)                                  │  │
│  │  • Role-based authorization                                  │  │
│  │  • HTTP caching headers                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Service Layer (MenuService)                                 │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Core Operations:                                     │   │  │
│  │  │  • getMenuTree()       • createMenu()                │   │  │
│  │  │  • getMenuById()       • updateMenu()                │   │  │
│  │  │  • getFavoriteMenus()  • deleteMenu()                │   │  │
│  │  │  • getRecentMenus()    • toggleFavorite()            │   │  │
│  │  │  • trackMenuAccess()   • getCategories()             │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Permission Filtering:                                │   │  │
│  │  │  • checkMenuPermissions()                            │   │  │
│  │  │  • validateFeatureFlags()                            │   │  │
│  │  │  • applyVisibilityRules()                            │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Caching:                                              │   │  │
│  │  │  • Redis Cache (30-min TTL)                          │   │  │
│  │  │  • Pattern-based invalidation                        │   │  │
│  │  │  • Automatic expiration                              │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Caching Layer                                               │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐  │  │
│  │  │  Redis Cache     │  │  LRU Memory Cache (if no Redis)  │  │  │
│  │  │  • Organization  │  │  • 100 entries max               │  │  │
│  │  │  • User scoped   │  │  • 30-min TTL                    │  │  │
│  │  │  • 30-min TTL    │  │  • Auto-evict on overflow        │  │  │
│  │  └──────────────────┘  └──────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           ▼                                        │
└─────────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DATABASE (PostgreSQL)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  menus Table (Core)                                          │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ Columns:                                               │  │  │
│  │  │  • id (UUID) [PK]                                      │  │  │
│  │  │  • organization_id (UUID) [FK]                         │  │  │
│  │  │  • parent_id (UUID) [FK, self-ref]                     │  │  │
│  │  │  • key (VARCHAR) - unique per org                      │  │  │
│  │  │  • label, title, description                           │  │  │
│  │  │  • icon, route, external_url                           │  │  │
│  │  │  • visible, visibility_type                            │  │  │
│  │  │  • feature_flag, required_permission*                  │  │  │
│  │  │  • category, order_index, nesting_level                │  │  │
│  │  │  • badge_icon, badge_counter_key, badge_style          │  │  │
│  │  │  • metadata (JSONB), breadcrumb_path (TEXT)             │  │  │
│  │  │  • created_by, updated_by, created_at, updated_at       │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  Indexes:                                                     │  │
│  │  • (organization_id, parent_id)                              │  │
│  │  • (organization_id, visible)                                │  │
│  │  • (feature_flag), (required_permission)                     │  │
│  │  • (nesting_level)                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  menu_usage Table (Tracking)                                │  │
│  │  • user_id (FK)  • menu_id (FK)  • organization_id (FK)   │  │
│  │  • is_favorite   • last_accessed_at  • access_count         │  │
│  │                                                               │  │
│  │  Indexes:                                                     │  │
│  │  • (user_id, organization_id)                                │  │
│  │  • (user_id, is_favorite)                                    │  │
│  │  • (user_id, last_accessed_at DESC)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  menu_categories Table                                       │  │
│  │  • id, organization_id, key, label, icon, color, order      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  menu_versions Table (Audit Trail)                           │  │
│  │  • menu_id, version_number, snapshot (JSONB)               │  │
│  │  • change_type, changed_fields, changed_by                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  menu_cache_state Table                                      │  │
│  │  • organization_id (PK)                                      │  │
│  │  • last_invalidated_at, total_menu_count                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Row-Level Security (RLS):                                         │
│  • Users see only menus in their organization                      │
│  • Admins can manage all menus in their organization               │
│  • Soft deletes enforced via visible flag                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Loading Menu Tree (Read Path)
```
Angular App
    │
    ├─ MenuService.loadMenuTree()
    │
    └─→ MenuCacheService.get()
        │
        └─→ Cache HIT? ─→ Return cached tree ✓
            │
            └─→ Cache MISS
                │
                └─→ HTTP GET /api/v1/menus
                    │
                    └─→ Express Routes (menus.ts)
                        │
                        └─→ MenuService.getMenuTree()
                            │
                            ├─→ Redis.get(cache:org:user:tree)
                            │   │
                            │   └─→ HIT? Return ✓
                            │   │
                            │   └─→ MISS? Query database
                            │
                            └─→ PostgreSQL
                                │
                                ├─ SELECT menus WHERE org = X AND visible = true
                                ├─ FILTER by permissions
                                ├─ FILTER by feature flags
                                ├─ FILTER by visibility
                                └─ BUILD tree structure
                                    │
                                    └─→ Cache in Redis (30 min TTL)
                                    └─→ Return to client
                                        │
                                        └─→ Cache in LRU memory
                                        └─→ Render in MenuComponent
```

### User Favorites (Write Path)
```
MenuComponent
    │
    ├─ User clicks star icon
    │
    └─→ MenuComponent.toggleFavorite()
        │
        └─→ MenuService.toggleFavorite(menuId)
            │
            └─→ HTTP POST /api/v1/menus/{menuId}/favorite
                │
                └─→ Express Routes
                    │
                    └─→ MenuService.toggleFavorite()
                        │
                        └─→ PostgreSQL
                            │
                            ├─ UPSERT menu_usage
                            │  SET is_favorite = !is_favorite
                            │
                            └─→ Invalidate cache
                                │
                                └─→ Redis.deletePattern(menu:org:user:*)
                                └─→ LRU cache invalidation
                                    │
                                    └─→ Return success
                                        │
                                        └─→ Update signal
                                        └─→ UI auto-updates
```

## Component Hierarchy

```
AppComponent
├── SidebarComponent
│   ├── Header (Logo + Collapse Button)
│   │
│   ├── MenuComponent (Main)
│   │   ├── MenuComponent (Level 1)
│   │   │   ├── MenuComponent (Level 2)
│   │   │   │   └── MenuComponent (Level 3...)
│   │   │   │       ├── Link or Button
│   │   │   │       ├── Icon
│   │   │   │       ├── Label
│   │   │   │       ├── Badge
│   │   │   │       └── Favorite Star
│   │   │   │
│   │   │   └── (Children expanded on demand)
│   │   │
│   │   └── (All items rendered recursively)
│   │
│   ├── Favorites Section
│   │   └── MenuComponent (Favorites)
│   │
│   ├── Recent Section
│   │   └── MenuComponent (Recent - limited to 5)
│   │
│   └── User Profile Section
│       └── Avatar + User Info
│
└── RouterOutlet (Page Content)
```

## State Management Diagram (Signals)

```
MenuService
│
├─ Signal: menuTree
│  └─ MenuNode[]
│
├─ Signal: menuMap
│  └─ Map<id, MenuNode>
│
├─ Signal: favorites
│  └─ Set<menuId>
│
├─ Signal: recent
│  └─ MenuNode[]
│
├─ Signal: categories
│  └─ MenuCategory[]
│
├─ Signal: isLoading
│  └─ boolean
│
├─ Signal: error
│  └─ string | null
│
└─ Computed Selector: allMenusFlat
   └─ MenuNode[] (flattened tree)

└─ Computed Selector: favoriteMenus
   └─ MenuNode[] (tree.filter(isFavorite))

└─ Computed Selector: recentMenus
   └─ MenuNode[] (sorted by access time)
```

## Security Layers

```
Request
  │
  ├─→ Authentication Layer
  │   └─ Verify JWT token
  │
  ├─→ Authorization Layer
  │   └─ Check role (admin/owner for mutations)
  │
  ├─→ Organization Layer
  │   └─ Verify org context
  │
  ├─→ Permission Layer
  │   └─ Check menu-specific permissions
  │
  ├─→ Feature Flag Layer
  │   └─ Check feature flag status
  │
  └─→ Database Layer (RLS)
      └─ Row-level security policies
         ├─ Org isolation
         ├─ Visibility checking
         ├─ Soft delete filtering
         └─ Role-based access
```

## Caching Strategy

```
Request for menu tree
  │
  ├─→ Level 1: HTTP Cache Headers (5 min)
  │   └─ Check browser/CDN cache
  │
  ├─→ Level 2: LRU Memory Cache (100 entries, 30 min TTL)
  │   └─ Check in-memory cache
  │
  ├─→ Level 3: Redis Cache (30 min TTL)
  │   └─ Check distributed cache
  │
  └─→ Level 4: Database Query
      └─ Query and rebuild cache
         ├─ Save to Redis (30 min)
         ├─ Save to LRU (30 min)
         └─ Add cache headers
```

## Feature Flag & Permission Integration

```
Permission Check Flow:
1. User requests menu
2. Backend receives request
3. Check: required_permission field exists?
   ├─ NO → Continue
   └─ YES → Check user has permission
       ├─ NO → Hide menu
       └─ YES → Continue

4. Check: feature_flag field exists?
   ├─ NO → Continue
   └─ YES → Check feature flag enabled?
       ├─ NO → Hide menu
       └─ YES → Return menu
```

## Performance Optimization Flow

```
Initial Load (< 500ms target)
├─ Browser cache check (0-5ms)
├─ LRU cache check (0-2ms)
├─ Redis cache check (5-10ms)
├─ Database query (50-200ms)
│  ├─ Filter by organization (index)
│  ├─ Filter by visible (index)
│  ├─ Check permissions (service)
│  ├─ Check feature flags (service)
│  └─ Build tree (computation)
├─ Cache results (50-100ms)
└─ Return to client (50-100ms)

Cached Load (< 100ms target)
├─ Browser cache check (0-5ms)
└─ Return cached response (< 100ms)
```

## Deployment Architecture

```
CDN (Cloudflare)
  │
  ├─→ Static assets caching
  └─→ HTTP cache headers
     │
     └─→ Angular Frontend
         ├─ Served from Vercel/Nginx
         └─ API calls to backend
            │
            └─→ Backend (Express)
                ├─ Deployed on Docker/Vercel
                ├─ Multiple instances
                └─ Connection pooling
                   │
                   └─→ PostgreSQL (Supabase)
                       ├─ Primary database
                       └─ RLS enforcement
                       └─ Automatic backups
                   │
                   └─→ Redis
                       └─ Cache layer
                       └─ Session storage
```

## Error Handling Flow

```
Error Occurs (e.g., Permission Denied)
  │
  ├─→ Backend throws error
  │   └─ MenuService
  │
  ├─→ Express error handler
  │   └─ Format error response
  │
  ├─→ HTTP response (401/403/500)
  │   │
  │   └─→ Angular receives error
  │       │
  │       ├─→ Set error signal
  │       ├─→ Log error
  │       └─→ Show error to user
  │
  └─→ User sees error message
      └─ Can retry or navigate away
```

---

## Summary

The system is architected as a **three-tier application** with:

1. **Frontend Tier** (Angular)
   - Components: MenuComponent, SidebarComponent
   - State: Signal-based MenuService
   - Caching: MenuCacheService (LRU)

2. **Backend Tier** (Express.js)
   - Routes: 13 REST endpoints
   - Service: MenuService with caching
   - Security: Auth, authorization, permissions

3. **Database Tier** (PostgreSQL)
   - 5 core tables with RLS
   - Soft deletes for audit trail
   - Optimized indexes for queries

The architecture emphasizes **performance**, **security**, and **scalability** with multi-layer caching, permission filtering, and audit logging throughout.
