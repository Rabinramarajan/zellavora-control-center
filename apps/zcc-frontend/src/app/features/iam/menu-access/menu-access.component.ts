import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '../../../core/api/iam.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { RoleListItem } from '../../../shared/models/iam.model';
import { IAM_BTN, IAM_INPUT, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { AppDialogService } from '../../../shared/components/dialog';
import { MenuAccessApi } from './menu-access.api';
import {
  MenuAccessDraft,
  MenuEntry,
  RoleMenuAccess,
  groupState,
  hasPermission,
  sameDraft,
  toggleEntry,
  visibleMenu,
} from './menu-access.model';

/**
 * Menu Access: choose which sidebar menus and sub-menus each role sees.
 * Saves only the role's navigation grants; its other permissions stay as
 * they are, and the preview shows the sidebar the role will actually get.
 */
@Component({
  selector: 'zcc-menu-access',
  standalone: true,
  imports: [IamPageHeaderComponent, NgTemplateOutlet],
  templateUrl: './menu-access.component.html',
  styleUrl: './menu-access.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuAccessComponent {
  private readonly api = inject(MenuAccessApi);
  private readonly iam = inject(IamApiService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly dialog = inject(AppDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly canManage = inject(PermissionService).can('roles:manage');

  protected readonly roles = signal<RoleListItem[]>([]);
  protected readonly menu = signal<MenuEntry[]>([]);
  protected readonly roleId = signal<string | null>(null);
  protected readonly saved = signal<RoleMenuAccess | null>(null);
  protected readonly draft = signal<MenuAccessDraft>({ restricted: false, keys: new Set() });
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected readonly loading = signal(true);
  protected readonly loadingRole = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly role = computed(() => this.saved()?.role ?? null);
  protected readonly readonly = computed(() => !this.canManage() || this.saving());

  protected readonly permissions = computed(() => new Set<string>(this.saved()?.permissions ?? []));

  /** System roles may gain entries but not lose the ones they have. */
  protected readonly lockedKeys = computed<ReadonlySet<string>>(() =>
    this.saved()?.role.isSystem ? new Set(this.saved()!.keys) : new Set()
  );

  protected readonly dirty = computed(() => {
    const saved = this.saved();
    return (
      !!saved &&
      !sameDraft(this.draft(), { restricted: saved.restricted, keys: new Set(saved.keys) })
    );
  });

  protected readonly preview = computed(() =>
    visibleMenu(this.menu(), this.draft(), this.permissions())
  );

  protected readonly selectedCount = computed(() => {
    const keys = this.draft().keys;
    const count = (entries: readonly MenuEntry[]): number =>
      entries.reduce((sum, e) => sum + (keys.has(e.key) ? 1 : 0) + count(e.children), 0);
    return count(this.menu());
  });

  /** Entries that are ticked but still hidden because the role lacks their permission. */
  protected readonly blocked = computed(() => {
    const keys = this.draft().keys;
    const perms = this.permissions();
    const out: { label: string; permission: string }[] = [];
    const walk = (entries: readonly MenuEntry[], trail: string[]) => {
      for (const e of entries) {
        const path = [...trail, e.label];
        if (
          keys.has(e.key) &&
          e.requiredPermission &&
          !hasPermission(perms, e.requiredPermission)
        ) {
          out.push({ label: path.join(' › '), permission: e.requiredPermission });
        }
        walk(e.children, path);
      }
    };
    walk(this.menu(), []);
    return out;
  });

  public constructor() {
    void this.load();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (this.dirty()) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', beforeUnload));
  }

  protected async selectRole(select: HTMLSelectElement): Promise<void> {
    const id = select.value;
    if (id === this.roleId()) return;
    if (this.dirty()) {
      const discard = await firstValueFrom(
        this.dialog.confirm({
          title: 'Discard changes?',
          message: `Your menu changes for ${this.role()?.name ?? 'this role'} have not been saved.`,
          confirmText: 'Discard',
          variant: 'danger',
        })
      );
      if (!discard) {
        // Put the picker back on the role still being edited.
        select.value = this.roleId() ?? '';
        return;
      }
    }
    await this.router.navigate([], { queryParams: { role: id }, replaceUrl: true });
    await this.loadRole(id);
  }

  protected setRestricted(on: boolean): void {
    this.draft.update((d) => ({ ...d, restricted: on }));
  }

  protected toggle(entry: MenuEntry, on: boolean): void {
    if (!on && this.lockedKeys().has(entry.key)) return;
    this.draft.update((d) => {
      const keys = toggleEntry(d.keys, entry, on);
      // A system role keeps what it had, even inside a cleared group.
      for (const key of this.lockedKeys()) keys.add(key);
      return { ...d, keys };
    });
  }

  protected selectAll(on: boolean): void {
    this.draft.update((d) => {
      const keys = new Set<string>();
      if (on) this.menu().forEach((e) => toggleEntry(keys, e, true).forEach((k) => keys.add(k)));
      for (const key of this.lockedKeys()) keys.add(key);
      return { ...d, keys };
    });
  }

  protected toggleCollapsed(key: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected state(entry: MenuEntry): 'all' | 'some' | 'none' {
    return groupState(this.draft().keys, entry);
  }

  /** A child of a granted group is shown with it and needs no tick of its own. */
  protected inherited(parent: MenuEntry | null): boolean {
    return !!parent && this.draft().keys.has(parent.key);
  }

  protected missing(entry: MenuEntry): boolean {
    return (
      !!entry.requiredPermission && !hasPermission(this.permissions(), entry.requiredPermission)
    );
  }

  protected reset(): void {
    const saved = this.saved();
    if (saved) this.draft.set({ restricted: saved.restricted, keys: new Set(saved.keys) });
  }

  protected async save(): Promise<void> {
    const id = this.roleId();
    if (!id || !this.dirty() || this.saving()) return;
    this.saving.set(true);
    try {
      const draft = this.draft();
      const res = await firstValueFrom(
        this.api.save(id, { restricted: draft.restricted, keys: [...draft.keys].sort() })
      );
      this.applySaved(res.data);
      this.feedback.success(`Menu access saved for ${res.data.role.name}.`);
    } catch (err) {
      this.feedback.error(err, 'Could not save menu access');
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [tree, roles] = await Promise.all([
        firstValueFrom(this.api.tree()),
        firstValueFrom(this.iam.listAllRoles()),
      ]);
      this.menu.set(tree.data);
      const sorted = [...roles.data].sort((a, b) => a.name.localeCompare(b.name));
      this.roles.set(sorted);

      const requested = this.route.snapshot.queryParamMap.get('role');
      const initial = sorted.find((r) => r.id === requested) ?? sorted[0];
      if (initial) await this.loadRole(initial.id);
    } catch (err) {
      this.loadError.set('The menu or role list could not be loaded.');
      this.feedback.error(err, 'Could not load menu access');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRole(id: string): Promise<void> {
    this.roleId.set(id);
    this.loadingRole.set(true);
    try {
      this.applySaved((await firstValueFrom(this.api.forRole(id))).data);
    } catch (err) {
      this.saved.set(null);
      this.feedback.error(err, 'Could not load this role’s menu access');
    } finally {
      this.loadingRole.set(false);
    }
  }

  private applySaved(access: RoleMenuAccess): void {
    this.saved.set(access);
    this.draft.set({ restricted: access.restricted, keys: new Set(access.keys) });
  }
}
