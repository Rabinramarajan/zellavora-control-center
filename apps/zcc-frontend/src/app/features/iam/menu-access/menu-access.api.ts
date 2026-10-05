import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../../../core/http/api-data.service';
import { MenuEntry, RoleMenuAccess } from './menu-access.model';

interface Envelope<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class MenuAccessApi {
  private readonly api = inject(ApiDataService);

  public tree(): Observable<Envelope<MenuEntry[]>> {
    return this.api.getData<Envelope<MenuEntry[]>>('/iam/menu-access/tree');
  }

  public forRole(roleId: string): Observable<Envelope<RoleMenuAccess>> {
    return this.api.getData<Envelope<RoleMenuAccess>>(`/iam/menu-access/roles/${roleId}`);
  }

  public save(
    roleId: string,
    body: { restricted: boolean; keys: string[] }
  ): Observable<Envelope<RoleMenuAccess>> {
    return this.api.putData<Envelope<RoleMenuAccess>>(`/iam/menu-access/roles/${roleId}`, body);
  }
}
