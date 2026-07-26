/**
 * `*hasFeature` — feature-flag style directive.
 *
 *   <billing-panel *hasFeature="'billing'" />
 *   <reports-tab   *hasFeature="'reports'" />
 *
 * Internally checks `feature:<name>` permission.
 */
import {
  Directive, Input, TemplateRef, ViewContainerRef,
  effect, signal, inject, OnDestroy
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

  private feature = signal<string>('');
  private viewRef: any = null;

  @Input() set hasFeature(value: string) {
    this.feature.set(value);
  }

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
    const ok = this.perms.hasFeature(this.feature());
    if (ok && !this.viewRef) {
      this.viewRef = this.vcr.createEmbeddedView(this.tpl);
    } else if (!ok && this.viewRef) {
      this.vcr.clear();
      this.viewRef = null;
    }
  }
}
