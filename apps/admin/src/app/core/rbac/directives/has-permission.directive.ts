/**
 * `*hasPermission` — structural directive that conditionally renders a
 * template based on the current user's permissions.
 *
 *   <button *hasPermission="'users:user:delete'" (click)="del(user)">Delete</button>
 *   <section *hasPermission="['users:user:read','users:user:update']; mode: 'all'">
 *     ...
 *   </section>
 *
 * Reactive: re-evaluates on every policy change.
 */
import {
  Directive, Input, TemplateRef, ViewContainerRef, effect,
  signal, inject, OnDestroy
} from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { PolicyStore } from '../store/policy.store';

@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnDestroy {
  private tpl = inject(TemplateRef);
  private vcr = inject(ViewContainerRef);
  private perms = inject(PermissionService);
  private store = inject(PolicyStore);

  private required = signal<string[]>([]);
  private mode: 'any' | 'all' = 'all';
  private viewRef: any = null;

  @Input() set hasPermission(value: string | string[]) {
    this.required.set(Array.isArray(value) ? value : [value]);
  }

  @Input() set hasPermissionMode(mode: 'any' | 'all') {
    this.mode = mode;
  }

  constructor() {
    // Re-evaluate on every policy change (signal effect)
    effect(() => {
      this.store.version();   // dependency tracking
      this.evaluate();
    });
  }

  ngOnDestroy(): void {
    this.vcr.clear();
    this.viewRef = null;
  }

  private evaluate(): void {
    const perms = this.required();
    const ok = this.mode === 'all'
      ? this.perms.canAll(perms)
      : this.perms.canAny(perms);

    if (ok && !this.viewRef) {
      this.viewRef = this.vcr.createEmbeddedView(this.tpl);
    } else if (!ok && this.viewRef) {
      this.vcr.clear();
      this.viewRef = null;
    }
  }
}
