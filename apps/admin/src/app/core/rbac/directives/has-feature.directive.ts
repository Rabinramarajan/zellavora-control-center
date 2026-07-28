/**
 * `*hasFeature` — feature-flag style directive.
 *
 *   <billing-panel *hasFeature="'billing'" />
 *   <reports-tab   *hasFeature="'reports'" />
 *
 * Internally checks `feature:<name>` permission.
 */
import {
  Directive, input, TemplateRef, ViewContainerRef,
  effect, inject, OnDestroy
} from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { PolicyStore } from '../store/policy.store';

@Directive({
  selector: '[hasFeature]',
  standalone: true
})
export class HasFeatureDirective implements OnDestroy {
  private tpl = inject(TemplateRef);
  private vcr = inject(ViewContainerRef);
  private perms = inject(PermissionService);
  private store = inject(PolicyStore);

  readonly hasFeature = input.required<string>();
  private viewRef: any = null;

  constructor() {
    effect(() => {
      this.store.version();
      this.evaluate();
    });
  }

  ngOnDestroy(): void {
    this.vcr.clear();
    this.viewRef = null;
  }

  private evaluate(): void {
    const ok = this.perms.hasFeature(this.hasFeature());
    if (ok && !this.viewRef) {
      this.viewRef = this.vcr.createEmbeddedView(this.tpl);
    } else if (!ok && this.viewRef) {
      this.vcr.clear();
      this.viewRef = null;
    }
  }
}
