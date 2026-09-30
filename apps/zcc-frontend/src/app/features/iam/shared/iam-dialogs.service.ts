import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppDialogService } from '@shared/components/dialog';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { FormDialogData, FormValues, IamFormDialogComponent } from './iam-form-dialog.component';
import {
  EntityPickerData,
  EntityPickerDialogComponent,
  PickerOption,
} from './entity-picker-dialog.component';

const PICKER_PAGE_SIZE = 25;

/** One-call helpers for IAM form dialogs, confirmations and entity pickers. */
@Injectable({ providedIn: 'root' })
export class IamDialogsService {
  private readonly dialog = inject(AppDialogService);
  private readonly iam = inject(IamApiService);
  private readonly admin = inject(IamAdminApiService);

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

  readonly searchRoles = async (q: string): Promise<PickerOption[]> => {
    const page = unwrap(
      await firstValueFrom(
        this.iam.listRoles({ q, page: 1, pageSize: PICKER_PAGE_SIZE, status: ['ACTIVE'] })
      )
    );
    return page.data.map((r) => ({ id: r.id, label: r.name, sublabel: r.description ?? r.key }));
  };

  readonly searchGroups = async (q: string): Promise<PickerOption[]> => {
    const page = unwrap(
      await firstValueFrom(
        this.iam.listGroups({ q, page: 1, pageSize: PICKER_PAGE_SIZE, status: ['ACTIVE'] })
      )
    );
    return page.data.map((g) => ({
      id: g.id,
      label: g.name,
      sublabel: g.description ?? g.typeLabel,
    }));
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
