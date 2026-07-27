import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { AuthUser } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly apiData = inject(ApiDataService);

  getUsers(params?: any): Observable<AuthUser[]> {
    return this.apiData.getData<AuthUser[]>('/admin/users', params);
  }

  getUserById(id: string): Observable<AuthUser> {
    return this.apiData.getData<AuthUser>(`/admin/users/${id}`);
  }

  createUser(user: Partial<AuthUser>): Observable<AuthUser> {
    return this.apiData.postData<AuthUser>('/admin/users', user);
  }

  updateUser(id: string, user: Partial<AuthUser>): Observable<AuthUser> {
    return this.apiData.putData<AuthUser>(`/admin/users/${id}`, user);
  }

  deleteUser(id: string): Observable<void> {
    return this.apiData.deleteData<void>(`/admin/users/${id}`);
  }
}
