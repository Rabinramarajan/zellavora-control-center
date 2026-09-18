# Admin Module Setup Guide

## Overview
The Admin module provides comprehensive management interfaces for Users, Roles, Resources, Branches, Audit Logs, Configs, and Groups using Angular 17+ standalone components and signal-based state management.

## Architecture

### Directory Structure
```
admin/
├── components/
│   ├── users/
│   │   ├── user-list/
│   │   └── user-detail/
│   ├── roles/
│   │   ├── role-list/
│   │   └── role-detail/
│   ├── resources/
│   │   └── resource-manager/
│   ├── branches/
│   │   └── branch-manager/
│   └── index.ts
├── services/
│   ├── admin-api.service.ts
│   ├── admin-store.service.ts
│   ├── admin-api.service.spec.ts
│   ├── admin-store.service.spec.ts
│   └── index.ts
├── models/
│   ├── admin.models.ts
│   └── index.ts
├── utils/
│   ├── search-filter.helper.ts
│   ├── pagination.helper.ts
│   ├── form-validation.ts
│   ├── search-filter.helper.spec.ts
│   ├── pagination.helper.spec.ts
│   ├── form-validation.spec.ts
│   └── index.ts
├── admin.routes.ts
├── index.ts
└── ADMIN_MODULE_SETUP.md (this file)
```

## Integration Steps

### 1. Add Routes to Main App
```typescript
// app.routes.ts
import { ADMIN_ROUTES } from '@features/admin';

export const routes: Routes = [
  // ... other routes
  {
    path: 'admin',
    children: ADMIN_ROUTES
  }
];
```

### 2. Provide Services
Services are already provided at root level via `providedIn: 'root'` in the service decorators.

### 3. Import Admin Module Index
```typescript
import { ADMIN_ROUTES, AdminStoreService, AdminApiService } from '@features/admin';
```

## Features

### Components
- **UserListComponent**: Display and manage users with search, filter, and pagination
- **UserDetailComponent**: Create and edit individual users
- **RoleListComponent**: Manage roles with resource assignments
- **RoleDetailComponent**: Edit role details and resources
- **ResourceManagerComponent**: Manage system resources
- **BranchManagerComponent**: Manage branches with location data

### State Management
- **AdminStoreService**: Centralized reactive state using Angular signals
- Computed selectors for derived state
- Automatic error and loading state tracking
- Full CRUD state mutations

### API Layer
- **AdminApiService**: RESTful HTTP communication layer
- Promise-based async/await pattern
- Proper error handling and status tracking

### Utilities
- **SearchFilterHelper**: Client-side filtering for all entities
- **PaginationHelper**: Pagination calculations and utilities
- **FormValidation**: Comprehensive form validation helpers

## Usage Examples

### Loading Users
```typescript
import { AdminStoreService } from '@features/admin';

export class MyComponent {
  private store = inject(AdminStoreService);

  ngOnInit() {
    const criteria = {
      pageSize: 50,
      pageNumber: 1,
      ascending: true
    };
    this.store.loadUsers(criteria);
  }

  get users() {
    return this.store.users();
  }
}
```

### Filtering Data
```typescript
import { SearchFilterHelper } from '@features/admin';

const activeUsers = SearchFilterHelper.filterUsers(users, {
  searchTerm: 'john',
  statusFilter: 'Active'
});
```

### Form Validation
```typescript
import { FormValidation } from '@features/admin';

const validation = FormValidation.validateUser(userFormData);
if (!validation.isValid) {
  console.log(validation.errors);
}
```

## Permissions
Components use `*hasPermission` directive for role-based access control:
- `admin:users:create`, `admin:users:read`, `admin:users:update`, `admin:users:delete`
- `admin:roles:create`, `admin:roles:read`, `admin:roles:update`, `admin:roles:delete`
- `admin:resources:create`, `admin:resources:read`, `admin:resources:update`, `admin:resources:delete`
- `admin:branches:create`, `admin:branches:read`, `admin:branches:update`, `admin:branches:delete`

## Testing
All services and utilities include comprehensive unit tests:
- `admin-api.service.spec.ts` - API communication tests
- `admin-store.service.spec.ts` - State management tests
- `user-list.component.spec.ts` - Component behavior tests
- `search-filter.helper.spec.ts` - Filter logic tests
- `pagination.helper.spec.ts` - Pagination tests
- `form-validation.spec.ts` - Validation tests

Run tests:
```bash
ng test --include='**/admin/**/*.spec.ts'
```

## Backend API Endpoints
All endpoints use `/api` base URL:
- `/user/*` - User management
- `/role/*` - Role management
- `/resource/*` - Resource management
- `/Branch/*` - Branch management
- `/auditlog/*` - Audit logs
- `/config/*` - Configuration
- `/group/*` - Group management

See `AdminApiService` for complete endpoint documentation.
