import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { ComponentPermissionService } from '../../core/permissions/component-permission.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { ComponentState } from '../../shared/models/component-permission.model';

/**
 * Structural Directive: *appComponentPermission
 * Controls component visibility and state based on permissions
 *
 * Usage:
 *   <button *appComponentPermission="'edit-button'; permissions: ['posts:edit']">
 *     Edit
 *   </button>
 *
 *   <div *appComponentPermission="'admin-panel'; roles: ['admin']; else: denialTemplate">
 *     Admin Panel
 *   </div>
 */
@Directive({
  selector: '[appComponentPermission]',
  standalone: true,
})
export class ComponentPermissionDirective implements OnInit, OnDestroy {
  @Input() appComponentPermission: string = '';
  @Input() permissions?: string | string[];
  @Input() roles?: string | string[];
  @Input() features?: string | string[];
  @Input() state?: ComponentState;
  @Input() else?: TemplateRef<any>;

  private viewCreated = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private componentPermService: ComponentPermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.updateView();
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
    this.viewCreated = false;
  }

  private async updateView(): Promise<void> {
    try {
      const permissionArray = Array.isArray(this.permissions)
        ? this.permissions
        : this.permissions
          ? [this.permissions]
          : undefined;

      const roleArray = Array.isArray(this.roles)
        ? this.roles
        : this.roles
          ? [this.roles]
          : undefined;

      const featureArray = Array.isArray(this.features)
        ? this.features
        : this.features
          ? [this.features]
          : undefined;

      const response = await this.componentPermService.checkComponentPermission({
        componentId: this.appComponentPermission,
        componentType: 'button' as any,
        permissions: permissionArray,
        roles: roleArray,
        features: featureArray,
        requiredState: this.state,
      });

      if (response.allowed) {
        if (!this.viewCreated) {
          this.viewContainer.clear();
          this.viewContainer.createEmbeddedView(this.templateRef);
          this.viewCreated = true;
        }
      } else {
        if (this.else) {
          this.viewContainer.clear();
          this.viewContainer.createEmbeddedView(this.else);
          this.viewCreated = false;
        } else {
          this.viewContainer.clear();
          this.viewCreated = false;
        }
      }
    } catch (error) {
      console.error('Component permission check error:', error);
      this.viewContainer.clear();
    }
  }
}

/**
 * Structural Directive: *appHasRole
 * Shows/hides element based on user role
 *
 * Usage:
 *   <div *appHasRole="'admin'">Admin Panel</div>
 *   <div *appHasRole="['admin', 'moderator']">Admin or Moderator</div>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective implements OnInit, OnDestroy {
  @Input() appHasRole: string | string[] = [];
  @Input() hasRoleElse?: TemplateRef<any>;

  private viewCreated = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    const roles = Array.isArray(this.appHasRole) ? this.appHasRole : [this.appHasRole];
    const userRole = this.permissionService.role();

    const hasRole = roles.includes(userRole);

    if (hasRole) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.viewCreated = true;
    } else if (this.hasRoleElse) {
      this.viewContainer.createEmbeddedView(this.hasRoleElse);
      this.viewCreated = false;
    }
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }
}

/**
 * Structural Directive: *appHasFeature
 * Shows/hides element based on feature flags
 *
 * Usage:
 *   <div *appHasFeature="'beta-dashboard'">
 *     New Dashboard (Beta)
 *   </div>
 *
 *   <div *appHasFeature="['feature-1', 'feature-2']; mode: 'all'">
 *     Requires both features
 *   </div>
 */
@Directive({
  selector: '[appHasFeature]',
  standalone: true,
})
export class HasFeatureDirective implements OnInit, OnDestroy {
  @Input() appHasFeature: string | string[] = [];
  @Input() featureMode: 'any' | 'all' = 'any';
  @Input() hasFeatureElse?: TemplateRef<any>;

  private viewCreated = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    const features = Array.isArray(this.appHasFeature)
      ? this.appHasFeature
      : [this.appHasFeature];

    try {
      let hasFeature: boolean;

      if (this.featureMode === 'all') {
        // Check if all features are enabled (would need feature service)
        // For now, simplified check
        hasFeature = features.length > 0;
      } else {
        hasFeature = features.length > 0;
      }

      if (hasFeature) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.viewCreated = true;
      } else if (this.hasFeatureElse) {
        this.viewContainer.createEmbeddedView(this.hasFeatureElse);
        this.viewCreated = false;
      }
    } catch (error) {
      console.error('Feature check error:', error);
      this.viewContainer.clear();
    }
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }
}

/**
 * Attribute Directive: [appComponentState]
 * Sets CSS classes based on component permission state
 *
 * Usage:
 *   <button [appComponentState]="'delete-button'">
 *     Delete
 *   </button>
 *
 *   <form [appComponentState]="'edit-form'">
 *     Form fields
 *   </form>
 */
@Directive({
  selector: '[appComponentState]',
  standalone: true,
})
export class ComponentStateDirective implements OnInit {
  @Input() appComponentState: string = '';

  constructor(
    private elementRef: any,
    private componentPermService: ComponentPermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const classes = this.componentPermService.getComponentStateClasses(
        this.appComponentState
      );

      if (classes) {
        classes.split(' ').forEach(cls => {
          if (cls) {
            this.elementRef.nativeElement.classList.add(cls);
          }
        });
      }
    } catch (error) {
      console.error('Component state directive error:', error);
    }
  }
}

/**
 * Attribute Directive: [appDisableIfNotPermitted]
 * Disables element if user doesn't have permission
 *
 * Usage:
 *   <button [appDisableIfNotPermitted]="'posts:delete'">
 *     Delete
 *   </button>
 */
@Directive({
  selector: '[appDisableIfNotPermitted]',
  standalone: true,
})
export class DisableIfNotPermittedDirective implements OnInit {
  @Input() appDisableIfNotPermitted: string | string[] = [];
  @Input() permissionMode: 'any' | 'all' = 'any';

  constructor(
    private elementRef: any,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const permissions = Array.isArray(this.appDisableIfNotPermitted)
        ? this.appDisableIfNotPermitted
        : [this.appDisableIfNotPermitted];

      const hasPermission = await this.permissionService.hasPermission(
        permissions,
        this.permissionMode
      );

      if (!hasPermission) {
        this.elementRef.nativeElement.disabled = true;
        this.elementRef.nativeElement.classList.add('disabled', 'opacity-50', 'cursor-not-allowed');
        this.elementRef.nativeElement.title = `You don't have permission for this action`;
      }
    } catch (error) {
      console.error('Permission check error:', error);
      this.elementRef.nativeElement.disabled = true;
    }
  }
}

/**
 * Attribute Directive: [appReadOnlyIfNotPermitted]
 * Makes element read-only if user doesn't have permission
 *
 * Usage:
 *   <input [appReadOnlyIfNotPermitted]="'posts:edit'" />
 */
@Directive({
  selector: '[appReadOnlyIfNotPermitted]',
  standalone: true,
})
export class ReadOnlyIfNotPermittedDirective implements OnInit {
  @Input() appReadOnlyIfNotPermitted: string | string[] = [];

  constructor(
    private elementRef: any,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const permissions = Array.isArray(this.appReadOnlyIfNotPermitted)
        ? this.appReadOnlyIfNotPermitted
        : [this.appReadOnlyIfNotPermitted];

      const hasPermission = await this.permissionService.hasPermission(permissions, 'any');

      if (!hasPermission) {
        this.elementRef.nativeElement.readOnly = true;
        this.elementRef.nativeElement.classList.add('readonly');
      }
    } catch (error) {
      console.error('Permission check error:', error);
    }
  }
}

/**
 * Attribute Directive: [appHideIfNotPermitted]
 * Hides element if user doesn't have permission
 *
 * Usage:
 *   <div [appHideIfNotPermitted]="'admin:access'">
 *     Admin content
 *   </div>
 */
@Directive({
  selector: '[appHideIfNotPermitted]',
  standalone: true,
})
export class HideIfNotPermittedDirective implements OnInit {
  @Input() appHideIfNotPermitted: string | string[] = [];

  constructor(
    private elementRef: any,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const permissions = Array.isArray(this.appHideIfNotPermitted)
        ? this.appHideIfNotPermitted
        : [this.appHideIfNotPermitted];

      const hasPermission = await this.permissionService.hasPermission(permissions, 'any');

      if (!hasPermission) {
        this.elementRef.nativeElement.style.display = 'none';
        this.elementRef.nativeElement.classList.add('hidden');
      }
    } catch (error) {
      console.error('Permission check error:', error);
      this.elementRef.nativeElement.style.display = 'none';
    }
  }
}

/**
 * Export all component permission directives
 */
export const COMPONENT_PERMISSION_DIRECTIVES = [
  ComponentPermissionDirective,
  HasRoleDirective,
  HasFeatureDirective,
  ComponentStateDirective,
  DisableIfNotPermittedDirective,
  ReadOnlyIfNotPermittedDirective,
  HideIfNotPermittedDirective,
] as const;
