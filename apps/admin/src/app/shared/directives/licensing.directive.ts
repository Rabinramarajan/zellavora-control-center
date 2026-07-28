import {
  Directive,
  input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { LicensingService } from '../../core/licensing/licensing.service';
import { Subject } from 'rxjs';

/**
 * Structural directive: *appHasFeature
 * Shows template only if feature is enabled for organization
 *
 * Usage:
 * <div *appHasFeature="'advanced-reporting'">
 *   Advanced reporting section
 * </div>
 *
 * With else:
 * <div *appHasFeature="'ai-assistant'; else noAI">
 *   AI features
 * </div>
 * <ng-template #noAI>
 *   AI not available in your plan
 * </ng-template>
 */
@Directive({
  selector: '[appHasFeature]',
  standalone: true,
})
export class HasFeatureDirective implements OnInit, OnDestroy {
  readonly appHasFeature = input.required<string>();
  readonly appHasFeatureElse = input<TemplateRef<any>>();

  private destroy$ = new Subject<void>();
  private hasRendered = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private licensingService: LicensingService
  ) {}

  ngOnInit(): void {
    effect(() => {
      const enabledFeatures = this.licensingService.enabledFeatures();
      const hasFeature = enabledFeatures.some(f => f.featureKey === this.appHasFeature());

      if (hasFeature && !this.hasRendered) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasRendered = true;
      } else if (!hasFeature && this.hasRendered) {
        this.viewContainer.clear();
        const elseTpl = this.appHasFeatureElse();
        if (elseTpl) {
          this.viewContainer.createEmbeddedView(elseTpl);
        }
        this.hasRendered = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Attribute directive: [appDisableIfFeatureLocked]
 * Disables element if feature is not enabled
 *
 * Usage:
 * <button [appDisableIfFeatureLocked]="'advanced-export'">
 *   Export Data
 * </button>
 */
@Directive({
  selector: '[appDisableIfFeatureLocked]',
  standalone: true,
})
export class DisableIfFeatureLockedDirective implements OnInit, OnDestroy {
  readonly appDisableIfFeatureLocked = input.required<string>();
  readonly appDisableIfFeatureLockedTooltip = input<string>();

  private destroy$ = new Subject<void>();

  constructor(
    private viewContainer: ViewContainerRef,
    private licensingService: LicensingService
  ) {}

  ngOnInit(): void {
    effect(() => {
      const enabledFeatures = this.licensingService.enabledFeatures();
      const hasFeature = enabledFeatures.some(f => f.featureKey === this.appDisableIfFeatureLocked());

      const element = this.viewContainer.element?.nativeElement;
      if (element) {
        if (hasFeature) {
          element.disabled = false;
          element.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
          element.disabled = true;
          element.classList.add('opacity-50', 'cursor-not-allowed');
          const tooltip = this.appDisableIfFeatureLockedTooltip();
          if (tooltip) {
            element.setAttribute('title', tooltip);
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Structural directive: *appHasModule
 * Shows template only if module is accessible
 *
 * Usage:
 * <div *appHasModule="'analytics'">
 *   Analytics section
 * </div>
 */
@Directive({
  selector: '[appHasModule]',
  standalone: true,
})
export class HasModuleDirective implements OnInit, OnDestroy {
  readonly appHasModule = input.required<string>();
  readonly appHasModuleElse = input<TemplateRef<any>>();

  private destroy$ = new Subject<void>();
  private hasRendered = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private licensingService: LicensingService
  ) {}

  ngOnInit(): void {
    effect(() => {
      const enabledModules = this.licensingService.enabledModules();
      const hasModule = enabledModules.some(m => m.moduleKey === this.appHasModule());

      if (hasModule && !this.hasRendered) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasRendered = true;
      } else if (!hasModule && this.hasRendered) {
        this.viewContainer.clear();
        const elseTpl = this.appHasModuleElse();
        if (elseTpl) {
          this.viewContainer.createEmbeddedView(elseTpl);
        }
        this.hasRendered = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Attribute directive: [appLicenseStatus]
 * Applies CSS classes based on license status
 *
 * Usage:
 * <div [appLicenseStatus]>
 *   License info (applies classes like 'license-active', 'license-trial', etc.)
 * </div>
 */
@Directive({
  selector: '[appLicenseStatus]',
  standalone: true,
})
export class LicenseStatusDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private viewContainer: ViewContainerRef,
    private licensingService: LicensingService
  ) {}

  ngOnInit(): void {
    effect(() => {
      const status = this.licensingService.licenseStatus();
      const element = this.viewContainer.element?.nativeElement;

      if (element && status) {
        // Remove all status classes
        ['license-active', 'license-trial', 'license-suspended', 'license-expired'].forEach(
          cls => element.classList.remove(cls)
        );

        // Add current status class
        element.classList.add(`license-${status.status}`);

        // Add warning class if expiring soon
        if (status.isExpiringSoon) {
          element.classList.add('license-expiring-soon');
        }

        // Add trial ending class
        if (status.isTrialEnding) {
          element.classList.add('license-trial-ending');
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

/**
 * Attribute directive: [appUpgradePath]
 * Adds data attributes for upgrade tracking
 *
 * Usage:
 * <button [appUpgradePath]="'advanced-reporting'">
 *   Upgrade for advanced reports
 * </button>
 */
@Directive({
  selector: '[appUpgradePath]',
  standalone: true,
})
export class UpgradePathDirective implements OnInit {
  readonly appUpgradePath = input.required<string>();

  constructor(private viewContainer: ViewContainerRef) {}

  ngOnInit(): void {
    const element = this.viewContainer.element?.nativeElement;
    if (element) {
      element.setAttribute('data-upgrade-path', this.appUpgradePath());
      element.setAttribute('data-upgrade-source', 'locked-feature');
      element.classList.add('cursor-pointer', 'hover:underline');
    }
  }
}

/**
 * Export all licensing directives for convenience
 */
export const LICENSING_DIRECTIVES = [
  HasFeatureDirective,
  DisableIfFeatureLockedDirective,
  HasModuleDirective,
  LicenseStatusDirective,
  UpgradePathDirective,
];
