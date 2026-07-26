# Component Permission Engine - Quick Start (5 Minutes)

## 1. Import Services & Directives (1 min)

```typescript
// In your component

import { COMPONENT_PERMISSION_DIRECTIVES } from './shared/directives/component-permission.directive';
import { ComponentPermissionService } from './core/permissions/component-permission.service';
import { ComponentPermissionStore } from './core/permissions/component-permission.store';

@Component({
  imports: [COMPONENT_PERMISSION_DIRECTIVES],
})
export class MyComponent {
  constructor(
    private componentPermService: ComponentPermissionService,
    private store: ComponentPermissionStore
  ) {}
}
```

## 2. Use Permission Directives (2 min)

### Permission-Based

```html
<!-- Show if has permission -->
<button *appComponentPermission="'edit-button'; permissions: ['posts:edit']">
  Edit Post
</button>

<!-- With fallback -->
<button
  *appComponentPermission="'delete-button'; permissions: ['posts:delete']; else: denied"
>
  Delete
</button>
<ng-template #denied>
  <button disabled>Delete (No Permission)</button>
</ng-template>
```

### Role-Based

```html
<!-- Show if admin -->
<div *appHasRole="'admin'">
  <h2>Admin Panel</h2>
</div>

<!-- Show if admin or moderator -->
<div *appHasRole="['admin', 'moderator']">
  Admin Controls
</div>
```

### Feature-Based

```html
<!-- Show if beta feature enabled -->
<div *appHasFeature="'beta-dashboard'">
  <h3>✨ New Dashboard</h3>
</div>
```

## 3. Use Attribute Directives (2 min)

```html
<!-- Disable button if no permission -->
<button [appDisableIfNotPermitted]="'posts:delete'">
  Delete
</button>

<!-- Read-only input if can't edit -->
<input [appReadOnlyIfNotPermitted]="'posts:edit'" />

<!-- Hide if no access -->
<div [appHideIfNotPermitted]="'admin:access'">
  Admin Content
</div>

<!-- Apply state CSS -->
<button [appComponentState]="'delete-button'">
  Delete
</button>
```

## Quick Permission Keys

| Action | Permission |
|--------|-----------|
| View | `resource:view` |
| Create | `resource:create` |
| Edit | `resource:edit` |
| Delete | `resource:delete` |
| Export | `resource:export` |
| Approve | `resource:approve` |

Example: `posts:edit`, `users:delete`, `reports:export`

## Common Patterns

### Edit Form (Read-Only by Default)

```typescript
this.componentPermService.registerComponentPermission('edit-form', {
  componentId: 'edit-form',
  componentType: 'form',
  requiredPermissions: ['posts:view'],
  defaultState: 'editable',
  stateOverrides: {
    'no-permission': 'readonly',
  },
  visibility: 'conditional',
});
```

```html
<form *appComponentPermission="'edit-form'">
  <input placeholder="Title" />
  <textarea placeholder="Content"></textarea>
  <button type="submit">Save</button>
</form>
```

### Admin-Only Section

```html
<div *appHasRole="'admin'; else: notAdmin">
  <h2>Admin Panel</h2>
  <button [appDisableIfNotPermitted]="'users:create'">Add User</button>
  <button [appDisableIfNotPermitted]="'users:delete'">Delete User</button>
</div>

<ng-template #notAdmin>
  <p>This area is for administrators only.</p>
</ng-template>
```

### Conditional Buttons

```html
<div>
  <!-- Show if can view -->
  <button *appComponentPermission="'view-btn'; permissions: ['posts:view']">
    View
  </button>

  <!-- Show if can edit -->
  <button *appComponentPermission="'edit-btn'; permissions: ['posts:edit']">
    Edit
  </button>

  <!-- Show if can delete -->
  <button *appComponentPermission="'delete-btn'; permissions: ['posts:delete']">
    Delete
  </button>
</div>
```

## Check Permissions in Code

```typescript
// Check if component visible
const isVisible = await this.componentPermService.isComponentVisible('edit-button');

// Check if editable
const isEditable = await this.componentPermService.isComponentEditable('form');

// Get component state
const state = await this.componentPermService.getComponentState('button-id', 'button');
console.log(state.isVisible);
console.log(state.isDisabled);
console.log(state.isReadonly);
console.log(state.isEditable);
```

## Store Usage

```typescript
// Get visible components
visibleComponents = this.store.visibleComponents;

// Get disabled components
disabledComponents = this.store.disabledComponents;

// Get CSS classes
classes = this.store.getComponentClasses('edit-button', 'btn btn-primary');

// Get attributes
attrs = this.store.getComponentAttributes('button-id');
// { disabled: true } or { readonly: true }
```

## Complete Example

```typescript
import { Component, OnInit } from '@angular/core';
import { COMPONENT_PERMISSION_DIRECTIVES } from './shared/directives/component-permission.directive';
import { ComponentPermissionService } from './core/permissions/component-permission.service';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [COMPONENT_PERMISSION_DIRECTIVES],
  template: `
    <div>
      <h1>Posts</h1>

      <!-- View button -->
      <button
        *appComponentPermission="'view-btn'; permissions: ['posts:view']"
        (click)="view()"
      >
        View
      </button>

      <!-- Edit button -->
      <button
        *appComponentPermission="'edit-btn'; permissions: ['posts:edit']"
        (click)="edit()"
      >
        Edit
      </button>

      <!-- Delete button (hidden by default) -->
      <button
        *appComponentPermission="'delete-btn'; permissions: ['posts:delete']; else: noPerm"
        (click)="delete()"
        class="btn-danger"
      >
        Delete
      </button>

      <!-- Admin-only -->
      <div *appHasRole="'admin'">
        <button [appDisableIfNotPermitted]="'posts:publish'">
          Publish
        </button>
      </div>

      <!-- Edit form -->
      <form *appComponentPermission="'edit-form'; permissions: ['posts:edit']">
        <input placeholder="Title" />
        <textarea placeholder="Content"></textarea>
        <button type="submit">Save</button>
      </form>

      <!-- Feature flag -->
      <div *appHasFeature="'post-ratings'">
        <h3>⭐ Ratings (Beta)</h3>
      </div>
    </div>

    <ng-template #noPerm>
      <button disabled class="opacity-50">Delete</button>
    </ng-template>
  `,
})
export class PostsComponent implements OnInit {
  constructor(private componentPermService: ComponentPermissionService) {}

  ngOnInit() {
    // Register component permissions
    this.componentPermService.registerComponentPermissions({
      'view-btn': {
        componentId: 'view-btn',
        componentType: 'button',
        requiredPermissions: ['posts:view'],
        defaultState: 'visible',
        visibility: 'conditional',
      },
      'edit-btn': {
        componentId: 'edit-btn',
        componentType: 'button',
        requiredPermissions: ['posts:edit'],
        defaultState: 'visible',
        visibility: 'conditional',
      },
      'delete-btn': {
        componentId: 'delete-btn',
        componentType: 'button',
        requiredPermissions: ['posts:delete'],
        defaultState: 'hidden',
        visibility: 'conditional',
      },
      'edit-form': {
        componentId: 'edit-form',
        componentType: 'form',
        requiredPermissions: ['posts:edit'],
        defaultState: 'editable',
        visibility: 'conditional',
      },
    });
  }

  view() { console.log('View'); }
  edit() { console.log('Edit'); }
  delete() { console.log('Delete'); }
}
```

## API Cheat Sheet

| Directive | Purpose | Example |
|-----------|---------|---------|
| `*appComponentPermission` | Main directive | `*appComponentPermission="'id'; permissions: ['perm']"` |
| `*appHasRole` | Role-based | `*appHasRole="'admin'"` |
| `*appHasFeature` | Feature flags | `*appHasFeature="'beta'"` |
| `[appDisableIfNotPermitted]` | Disable button | `[appDisableIfNotPermitted]="'posts:delete'"` |
| `[appReadOnlyIfNotPermitted]` | Read-only input | `[appReadOnlyIfNotPermitted]="'posts:edit'"` |
| `[appHideIfNotPermitted]` | Hide element | `[appHideIfNotPermitted]="'admin:access'"` |
| `[appComponentState]` | Apply CSS | `[appComponentState]="'button-id'"` |

## Service Methods

```typescript
// Check permission
await this.componentPermService.checkComponentPermission(request);

// Get state
await this.componentPermService.getComponentState(componentId, type);

// Get states (batch)
await this.componentPermService.getComponentStates(componentIds);

// Check visibility
await this.componentPermService.isComponentVisible(componentId);

// Check editable
await this.componentPermService.isComponentEditable(componentId);

// Check disabled
await this.componentPermService.isComponentDisabled(componentId);

// Check readonly
await this.componentPermService.isComponentReadonly(componentId);

// Register single
this.componentPermService.registerComponentPermission(id, config);

// Register multiple
this.componentPermService.registerComponentPermissions(configMap);

// Sync states
await this.componentPermService.syncComponentStates(componentIds);

// Clear cache
this.componentPermService.clearCache();
```

## Troubleshooting

**Q: Directive not working?**
- A: Import COMPONENT_PERMISSION_DIRECTIVES in component
- A: Check component ID is registered
- A: Verify permissions exist

**Q: State not updating?**
- A: Ensure service methods called
- A: Check signals subscribed
- A: Verify store provided

**Q: Component always hidden?**
- A: Check permission exists in system
- A: Verify user has permission
- A: Check configuration

---

**Ready to use! 🚀**

See [COMPONENT_PERMISSION_ENGINE.md](./COMPONENT_PERMISSION_ENGINE.md) for full reference.
