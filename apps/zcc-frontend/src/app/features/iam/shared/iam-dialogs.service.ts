import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppDialogService } from '@shared/components/dialog';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { GroupTreeNode } from '@shared/models/iam.model';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { FormDialogData, FormValues, IamFormDialogComponent } from './iam-form-dialog.component';
import {
  EntityPickerData,
  EntityPickerDialogComponent,
  PickerOption,
} from './entity-picker-dialog.component';

const PICKER_PAGE_SIZE = 25;

const CACHE_TTL_MS = 30_000;

const filterOptions = (options: PickerOption[], q: string): PickerOption[] => {
  const term = q.trim().toLowerCase();
  if (!term) return options;
  return options.filter(
    (o) => o.label.toLowerCase().includes(term) || (o.sublabel ?? '').toLowerCase().includes(term)
  );
};

/** One-call helpers for IAM form dialogs, confirmations and entity pickers. */
@Injectable({ providedIn: 'root' })
export class IamDialogsService {
  private readonly dialog = inject(AppDialogService);
  private readonly iam = inject(IamApiService);
  private readonly admin = inject(IamAdminApiService);
  private readonly cache = new Map<string, { at: number; value: Promise<PickerOption[]> }>();

  /** Reuse a full list for a few seconds so each keystroke doesn't refetch it. */
  private cached(key: string, load: () => Promise<PickerOption[]>): Promise<PickerOption[]> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
    const value = load();
    value.catch(() => this.cache.delete(key));
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  form(data: FormDialogData): Promise<FormValues | null> {
    const ref = this.dialog.open<IamFormDialogComponent, FormDialogData, FormValues | null>(
      IamFormDialogComponent,
      { data, size: 'md', disableClose: true }
    );
    return firstValueFrom(ref.closed).then((v) => v ?? null);
  }

  confirm(
    title: string,
    message: string,
    confirmText = 'Confirm',
    danger = true
  ): Promise<boolean> {
    return firstValueFrom(
      this.dialog.confirm({ title, message, confirmText, variant: danger ? 'danger' : 'primary' })
    );
  }

  pick(data: EntityPickerData): Promise<string[] | null> {
    const ref = this.dialog.open<EntityPickerDialogComponent, EntityPickerData, string[] | null>(
      EntityPickerDialogComponent,
      { data, size: 'md', disableClose: true }
    );
    return firstValueFrom(ref.closed).then((v) => v ?? null);
  }

  // Search sources ------------------------------------------------------------

  readonly searchUsers = async (q: string): Promise<PickerOption[]> => {
    const page = unwrap(
      await firstValueFrom(
        this.iam.listIamUsers({ q, page: 1, pageSize: PICKER_PAGE_SIZE, status: ['ACTIVE'] })
      )
    );
    return page.data.map((u) => ({ id: u.id, label: u.fullName, sublabel: u.email }));
  };

  /** Every role; a short-lived cache so typing in the picker filters locally. */
  readonly searchRoles = async (q: string): Promise<PickerOption[]> => {
    const roles = await this.cached('roles', async () =>
      unwrap(await firstValueFrom(this.iam.listAllRoles()))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({
          id: r.id,
          label: r.name,
          sublabel: r.description ?? r.key,
          badge: r.status === 'INACTIVE' ? 'Inactive' : r.isSystem ? 'System' : null,
        }))
    );
    return filterOptions(roles, q);
  };

  /** Every group with its child groups, flattened depth-first so children sit under parents. */
  readonly searchGroups = async (q: string): Promise<PickerOption[]> => {
    const groups = await this.cached('groups', async () => {
      const flat: PickerOption[] = [];
      const walk = (nodes: GroupTreeNode[], depth: number, parent: string | null): void => {
        for (const g of [...nodes].sort((a, b) => a.name.localeCompare(b.name))) {
          flat.push({
            id: g.id,
            label: g.name,
            sublabel: parent ? `Under ${parent}` : (g.description ?? g.typeLabel),
            depth,
            badge: g.status === 'INACTIVE' ? 'Inactive' : null,
          });
          walk(g.children ?? [], depth + 1, g.name);
        }
      };
      walk(unwrap(await firstValueFrom(this.iam.getGroupTree())), 0, null);
      return flat;
    });
    // While searching, show matches flat; the tree indentation only makes sense unfiltered.
    return q.trim() ? filterOptions(groups, q).map((g) => ({ ...g, depth: 0 })) : groups;
  };

  readonly searchTeams = async (q: string): Promise<PickerOption[]> => {
    const page = await firstValueFrom(
      this.admin.listTeams({ q, page: 1, pageSize: PICKER_PAGE_SIZE })
    );
    return page.data.map((t) => ({
      id: t.id,
      label: t.name,
      sublabel: `${t.memberCount} members`,
    }));
  };

  readonly searchDepartments = async (q: string): Promise<PickerOption[]> => {
    const page = await firstValueFrom(
      this.admin.listDepartments({ q, status: 'active', page: 1, pageSize: 100 })
    );
    return page.data.map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: d.parentName ? `Under ${d.parentName}` : `${d.memberCount} members`,
    }));
  };
}
