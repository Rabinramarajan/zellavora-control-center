/**
 * `*hasRole` — render only if current user has the named role.
 *
 *   <a *hasRole="'org_admin'" routerLink="/admin">Admin</a>
 *   <a *hasRole="['hr','recruiter']" routerLink="/candidates">Candidates</a>
 */
import {
  Directive, Input, TemplateRef, ViewContainerRef,
  effect, signal, inject, OnDestroy
} from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { PolicyStore } from '../store/policy.store';

@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective implements OnDestroy {
  private tpl = inject(TemplateRef);
  private vcr = inject(ViewContainerRef);
  private perms = inject(PermissionService);
  private store = inject(PolicyStore);

  private required = signal<string[]>([]);
  private viewRef: any = null;

  @Input() set hasRole(value: string | string[]) {
    this.required.set(Array.isArray(value) ? value : [value]);
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
    const ok = this.perms.hasAnyRole(this.required());
    if (ok && !this.viewRef) {
      this.viewRef = this.vcr.createEmbeddedView(this.tpl);
    } else if (!ok && this.viewRef) {
      this.vcr.clear();
      this.viewRef = null;
    }
  }
}
