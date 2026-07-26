# Component-Level Permission Engine

Fine-grained authorization system for individual UI components with multiple permission states and flexible configuration.

## Overview

The component permission engine provides:
- **Component-level control** - Fine-grained permissions for individual components
- **Multiple states** - Visible, Hidden, Disabled, Read-only, Editable
- **Flexible configuration** - Permission, role, and feature-based control
- **Reusable directives** - *hasPermission, *hasRole, *hasFeature
- **Signal store** - Reactive state management
- **CSS integration** - Automatic class application
- **Fallback UI** - Else templates for denied access

## Architecture

```
Component Permission Engine
├── Models (Type Definitions)
│   ├── ComponentPermission - Permission configuration
│   ├── ComponentState - Visual state enum
│   ├── ComponentType - Component type enum
│   └── ComponentPermissionState - Runtime state
│
├── Service (Core Logic)
│   ├── ComponentPermissionService
│   │   ├── checkComponentPermission()
│   │   ├── getComponentState()
│   │   ├── isComponentVisible()
│   │   ├── isComponentEditable()
│   │   └── More methods...
│   │
│   └── Signal Store (State Management)
│       ├── ComponentPermissionStore
│       ├── componentStates signal
│       ├── componentVisibility signal
│       ├── Computed selectors
│       └── Store methods
│
└── Directives (Template Integration)
    ├── *appComponentPermission - Main directive
    ├── *appHasRole - Role-based rendering
    ├── *appHasFeature - Feature-based rendering
    ├── [appComponentState] - State CSS application
    ├── [appDisableIfNotPermitted] - Attribute directive
    ├── [appReadOnlyIfNotPermitted] - Read-only attribute
    └── [appHideIfNotPermitted] - Hide attribute
```

## File Structure

```
Backend:
├── (No backend changes - uses existing permission system)

Frontend:
├── models/
│   └── component-permission.model.ts          [300+ lines]
├── services/
│   ├── component-permission.service.ts        [400+ lines]
│   └── component-permission.store.ts          [300+ lines]
└── directives/
    └── component-permission.directive.ts      [400+ lines]
```

## Component States

### Visible
Component is visible and fully interactive.
```html
<button class="btn btn-primary">Click me</button>
```

### Hidden
Component is not visible (DOM removed).
```html
<!-- Not rendered at all -->
```

### Disabled
Component is visible but disabled (cannot interact).
```html
<button disabled class="disabled opacity-50">Cannot click</button>
```

### Read-only
Component is visible but read-only (cannot modify).
```html
<input readonly value="Cannot edit" />
```

### Editable
Component is visible and fully editable.
```html
<input type="text" placeholder="Can edit" />
```

## Component Types

Supported component types:
- `button` - Push button
- `card` - Card component
- `table` - Data table
- `tab` - Tab pane
- `section` - Section/div
- `widget` - Widget/card
- `dialog` - Modal dialog
- `form` - Form element
- `column` - Table column
- `menu_item` - Menu item
- `toolbar_button` - Toolbar button
- `fab` - Floating action button
- `action` - Action element
- `input` - Text input
- `textarea` - Text area
- `select` - Select dropdown
- `checkbox` - Checkbox
- `radio` - Radio button
- `switch` - Toggle switch
- And more...

## Usage Examples

### Basic Permission Check

```html
<!-- Show only if user has 'posts:view' permission -->
<button *appComponentPermission="'view-button'; permissions: ['posts:view']">
  View Post
</button>

<!-- Show with else template -->
<div *appComponentPermission="'admin-panel'; permissions: ['admin:access']; else: noAccess">
  <h2>Admin Panel</h2>
</div>

<ng-template #noAccess>
  <p>You don't have access to this area.</p>
</ng-template>
```

### Role-Based Access

```html
<!-- Show if user is admin -->
<div *appHasRole="'admin'">
  Admin Controls
</div>

<!-- Show if user is admin or moderator -->
<div *appHasRole="['admin', 'moderator']">
  Admin or Moderator Controls
</div>

<!-- With else template -->
<div *appHasRole="'admin'; else: notAdmin">
  Admin Area
</div>

<ng-template #notAdmin>
  <p>Restricted to administrators</p>
</ng-template>
```

### Feature Flags

```html
<!-- Show if beta feature enabled -->
<div *appHasFeature="'beta-dashboard'">
  <h3>✨ New Dashboard (Beta)</h3>
</div>

<!-- Require all features -->
<div *appHasFeature="['feature-1', 'feature-2']; mode: 'all'">
  Advanced Features
</div>
```

### Attribute-Based Control

```html
<!-- Disable if no permission -->
<button [appDisableIfNotPermitted]="'posts:delete'">
  Delete Post
</button>

<!-- Read-only if no edit permission -->
<input [appReadOnlyIfNotPermitted]="'posts:edit'" />

<!-- Hide if no permission -->
<div [appHideIfNotPermitted]="'admin:access'">
  Admin Content
</div>
```

### CSS Classes

```html
<!-- Apply state classes automatically -->
<button [appComponentState]="'delete-button'">
  Delete
</button>

<!-- Results in:
<button class="disabled opacity-50 cursor-not-allowed">Delete</button>
if user doesn't have permission
-->
```

## Service Usage

### Check Component Permission

```typescript
const response = await this.componentPermService.checkComponentPermission({
  componentId: 'edit-button',
  componentType: 'button',
  permissions: ['posts:edit'],
  state: ComponentState.VISIBLE
});

if (response.allowed) {
  // Show component
} else {
  // Hide component or apply fallback state
}
```

### Get Component State

```typescript
const state = await this.componentPermService.getComponentState(
  'edit-form',
  ComponentType.FORM
);

console.log(state.isVisible);   // boolean
console.log(state.isEditable);  // boolean
console.log(state.isDisabled);  // boolean
console.log(state.isReadonly);  // boolean
```

### Register Component Permissions

```typescript
// Register single component
this.componentPermService.registerComponentPermission('edit-button', {
  componentId: 'edit-button',
  componentType: ComponentType.BUTTON,
  requiredPermissions: ['posts:edit'],
  defaultState: ComponentState.VISIBLE,
  visibility: VisibilityState.CONDITIONAL,
});

// Register multiple components
this.componentPermService.registerComponentPermissions(
  new Map([
    ['view-button', viewButtonConfig],
    ['edit-button', editButtonConfig],
    ['delete-button', deleteButtonConfig],
  ])
);
```

### Check Component Visibility

```typescript
const isVisible = await this.componentPermService.isComponentVisible('edit-button');
const isEditable = await this.componentPermService.isComponentEditable('edit-form');
const isDisabled = await this.componentPermService.isComponentDisabled('delete-button');
const isReadonly = await this.componentPermService.isComponentReadonly('form-field');
```

## Signal Store Usage

### Access Component States

```typescript
// In component
export class MyComponent {
  constructor(private store: ComponentPermissionStore) {}

  visibleComponents = this.store.visibleComponents; // Computed
  hiddenComponents = this.store.hiddenComponents;   // Computed
  disabledComponents = this.store.disabledComponents; // Computed
  editableComponents = this.store.editableComponents; // Computed
}
```

```html
<!-- In template -->
<div>
  <p>Visible components: {{ (visibleComponents() | slice:0:5).join(', ') }}</p>
  <p>Hidden components: {{ (hiddenComponents() | slice:0:5).join(', ') }}</p>
</div>
```

### Set Component States

```typescript
// Set single state
this.store.setComponentState('edit-button', {
  componentId: 'edit-button',
  currentState: ComponentState.VISIBLE,
  isVisible: true,
  isDisabled: false,
  isReadonly: false,
  isEditable: true,
});

// Set multiple states
this.store.setComponentStates({
  'button-1': state1,
  'button-2': state2,
  'button-3': state3,
});
```

### Get Component Attributes

```typescript
const attrs = this.store.getComponentAttributes('edit-button');
// { disabled: true } or { readonly: true } or { hidden: true }

// Use in template
<button [attr.disabled]="attrs.disabled" [attr.readonly]="attrs.readonly">
  Edit
</button>
```

### Get Component CSS Classes

```typescript
const classes = this.store.getComponentClasses('edit-button', 'btn btn-primary');
// Returns: "btn btn-primary disabled opacity-50 cursor-not-allowed"

// Use in template binding
<button [class]="classes">Edit</button>
```

## Configuration Examples

### Edit Button

```typescript
const editButtonConfig: ComponentPermission = {
  componentId: 'edit-button',
  componentType: ComponentType.BUTTON,
  requiredPermissions: ['posts:edit'],
  defaultState: ComponentState.VISIBLE,
  stateOverrides: {
    'no-permission': ComponentState.HIDDEN,
    'admin': ComponentState.VISIBLE,
  },
  visibility: VisibilityState.CONDITIONAL,
};
```

### Delete Button (High Risk)

```typescript
const deleteButtonConfig: ComponentPermission = {
  componentId: 'delete-button',
  componentType: ComponentType.BUTTON,
  requiredPermissions: ['posts:delete'],
  defaultState: ComponentState.HIDDEN,
  stateOverrides: {
    'owner': ComponentState.VISIBLE,
    'admin': ComponentState.VISIBLE,
  },
  visibility: VisibilityState.CONDITIONAL,
  metadata: {
    riskLevel: 'high',
    requiresConfirmation: true,
  },
};
```

### Edit Form

```typescript
const editFormConfig: ComponentPermission = {
  componentId: 'edit-form',
  componentType: ComponentType.FORM,
  requiredPermissions: ['posts:edit'],
  defaultState: ComponentState.EDITABLE,
  stateOverrides: {
    'no-permission': ComponentState.READONLY,
    'viewer': ComponentState.READONLY,
  },
  visibility: VisibilityState.CONDITIONAL,
};
```

### Admin Panel

```typescript
const adminPanelConfig: ComponentPermission = {
  componentId: 'admin-panel',
  componentType: ComponentType.SECTION,
  requiredRoles: ['admin', 'owner'],
  defaultState: ComponentState.VISIBLE,
  visibility: VisibilityState.CONDITIONAL,
  conditionalRender: {
    condition: 'OR',
    roles: ['admin', 'owner'],
  },
};
```

## Complete Component Example

```typescript
import { Component, OnInit } from '@angular/core';
import { ComponentPermissionService } from './core/permissions/component-permission.service';
import { ComponentPermissionStore } from './core/permissions/component-permission.store';
import { ComponentState, ComponentType } from './shared/models/component-permission.model';
import { COMPONENT_PERMISSION_DIRECTIVES } from './shared/directives/component-permission.directive';

@Component({
  selector: 'app-post-editor',
  standalone: true,
  imports: [COMPONENT_PERMISSION_DIRECTIVES],
  template: `
    <div>
      <!-- Edit button with permission -->
      <button
        *appComponentPermission="'edit-button'; permissions: ['posts:edit']"
        (click)="edit()"
        class="btn btn-primary"
      >
        Edit Post
      </button>

      <!-- Delete button (hidden by default) -->
      <button
        *appComponentPermission="'delete-button'; permissions: ['posts:delete']; else: deniedDelete"
        (click)="delete()"
        class="btn btn-danger"
      >
        Delete Post
      </button>

      <!-- Admin-only section -->
      <div *appHasRole="'admin'">
        <h3>Admin Tools</h3>
        <button [appDisableIfNotPermitted]="'posts:unpublish'">
          Unpublish
        </button>
      </div>

      <!-- Conditional read-only form -->
      <form *appComponentPermission="'post-form'">
        <input
          type="text"
          [appReadOnlyIfNotPermitted]="'posts:edit'"
          placeholder="Post title"
        />
        <textarea
          [appReadOnlyIfNotPermitted]="'posts:edit'"
          placeholder="Post content"
        ></textarea>
      </form>

      <!-- Feature flag section -->
      <div *appHasFeature="'post-comments'">
        <h3>Comments</h3>
        <div>Comment section</div>
      </div>
    </div>

    <ng-template #deniedDelete>
      <button disabled class="btn btn-danger opacity-50">
        Delete (Not Permitted)
      </button>
    </ng-template>
  `,
})
export class PostEditorComponent implements OnInit {
  constructor(
    private componentPermService: ComponentPermissionService,
    private store: ComponentPermissionStore
  ) {}

  ngOnInit() {
    this.registerComponentPermissions();
  }

  private registerComponentPermissions() {
    this.componentPermService.registerComponentPermissions({
      'edit-button': {
        componentId: 'edit-button',
        componentType: ComponentType.BUTTON,
        requiredPermissions: ['posts:edit'],
        defaultState: ComponentState.VISIBLE,
        visibility: 'conditional' as any,
      },
      'delete-button': {
        componentId: 'delete-button',
        componentType: ComponentType.BUTTON,
        requiredPermissions: ['posts:delete'],
        defaultState: ComponentState.HIDDEN,
        visibility: 'conditional' as any,
      },
      'post-form': {
        componentId: 'post-form',
        componentType: ComponentType.FORM,
        requiredPermissions: ['posts:view'],
        defaultState: ComponentState.EDITABLE,
        stateOverrides: {
          'no-permission': ComponentState.READONLY,
        },
        visibility: 'conditional' as any,
      },
    });
  }

  edit() {
    console.log('Edit post');
  }

  delete() {
    if (confirm('Are you sure?')) {
      console.log('Delete post');
    }
  }
}
```

## Best Practices

### 1. Component Naming
```typescript
// Good
'edit-button'
'delete-dialog'
'admin-panel-section'
'user-form'

// Avoid
'button123'
'comp-abc'
'temp-div'
```

### 2. Permission Binding
```typescript
// Good - specific permissions
requiredPermissions: ['posts:edit']
requiredPermissions: ['posts:delete']

// Avoid - vague
requiredPermissions: ['can_edit']
requiredPermissions: ['edit_permission']
```

### 3. State Configuration
```typescript
// Good - clear defaults
defaultState: ComponentState.VISIBLE
stateOverrides: {
  'viewer': ComponentState.READONLY,
  'no-permission': ComponentState.HIDDEN,
}

// Avoid - ambiguous
defaultState: undefined
stateOverrides: {}
```

### 4. Conditional Rendering
```typescript
// Good - use else templates
<div *appComponentPermission="'admin'; else: notAdmin">
  Admin area
</div>
<ng-template #notAdmin>
  <p>No access</p>
</ng-template>

// Avoid - leave blank
<div *appComponentPermission="'admin'"></div>
```

## Performance Considerations

- **Cache component states** in the signal store
- **Batch permission checks** when possible
- **Use computed selectors** instead of recalculating
- **Memoize permission results** in service
- **Lazy-load component configs** when needed

## Testing

### Unit Tests
```typescript
describe('ComponentPermissionService', () => {
  it('should check component permission');
  it('should get component state');
  it('should handle role-based permissions');
  it('should evaluate conditional rendering');
  it('should cache component states');
});
```

### Component Tests
```typescript
describe('ComponentPermissionDirective', () => {
  it('should show component if permitted');
  it('should hide component if not permitted');
  it('should apply state-specific CSS');
  it('should render else template on denial');
});
```

## Troubleshooting

### Component Always Hidden
- Check if permissions are defined
- Verify user has required permission
- Check if permission exists in system

### Directive Not Working
- Ensure directive imported in component
- Check component ID is registered
- Verify permission key format

### State Not Updating
- Ensure ComponentPermissionStore is provided
- Check if state changes trigger detection
- Verify signals are subscribed

---

**Status:** Production Ready  
**Version:** 1.0.0  
**Last Updated:** 2026-07-26
