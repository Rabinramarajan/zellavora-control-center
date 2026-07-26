import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { PermissionService } from '../../core/permissions/permission.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Structural Directive: *appHasPermission
 * Shows/hides element based on user permissions
 *
 * Usage:
 *   <button *appHasPermission="'projects:create'">Create Project</button>
 *   <div *appHasPermission="['admin:panel', 'admin:settings']; let has; mode: 'any'">Admin</div>
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  @Input() appHasPermission: string | string[] = [];
  @Input() appHasPermissionMode: 'any' | 'all' = 'any';

  private destroy$ = new Subject<void>();
  private hasPermission = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.updateView();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async updateView(): Promise<void> {
    try {
      const permissions = Array.isArray(this.appHasPermission)
        ? this.appHasPermission
        : [this.appHasPermission];

      this.hasPermission = await this.permissionService.hasPermission(
        permissions,
        this.appHasPermissionMode
      );

      if (this.hasPermission) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      this.viewContainer.clear();
    }
  }
}

/**
 * Structural Directive: *appHasAnyPermission
 * Shows/hides element if user has ANY of the permissions
 *
 * Usage:
 *   <div *appHasAnyPermission="['admin:access', 'moderator:access']">
 *     Admin or Moderator only
 *   </div>
 */
@Directive({
  selector: '[appHasAnyPermission]',
  standalone: true,
})
export class HasAnyPermissionDirective implements OnInit, OnDestroy {
  @Input() appHasAnyPermission: string[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const hasPermission = await this.permissionService.hasAnyPermission(
        this.appHasAnyPermission
      );

      if (hasPermission) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      this.viewContainer.clear();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Structural Directive: *appHasAllPermissions
 * Shows/hides element if user has ALL permissions
 *
 * Usage:
 *   <div *appHasAllPermissions="['projects:edit', 'projects:delete']">
 *     Can edit and delete projects
 *   </div>
 */
@Directive({
  selector: '[appHasAllPermissions]',
  standalone: true,
})
export class HasAllPermissionsDirective implements OnInit, OnDestroy {
  @Input() appHasAllPermissions: string[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const hasPermission = await this.permissionService.hasAllPermissions(
        this.appHasAllPermissions
      );

      if (hasPermission) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      this.viewContainer.clear();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Attribute Directive: [appDisableIfNoPermission]
 * Disables element if user doesn't have permission
 *
 * Usage:
 *   <button [appDisableIfNoPermission]="'projects:delete'">Delete</button>
 */
@Directive({
  selector: '[appDisableIfNoPermission]',
  standalone: true,
})
export class DisableIfNoPermissionDirective implements OnInit {
  @Input() appDisableIfNoPermission: string = '';

  constructor(
    private elementRef: any,
    private permissionService: PermissionService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const hasPermission = await this.permissionService.hasPermission(
        this.appDisableIfNoPermission
      );

      if (!hasPermission) {
        this.elementRef.nativeElement.disabled = true;
        this.elementRef.nativeElement.classList.add('disabled');
        this.elementRef.nativeElement.title = `You don't have permission for this action`;
      }
    } catch (error) {
      console.error('Permission check error:', error);
      this.elementRef.nativeElement.disabled = true;
    }
  }
}

/**
 * Export all permission directives
 */
export const PERMISSION_DIRECTIVES = [
  HasPermissionDirective,
  HasAnyPermissionDirective,
  HasAllPermissionsDirective,
  DisableIfNoPermissionDirective,
] as const;
