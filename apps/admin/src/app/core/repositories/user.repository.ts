import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UserApiService } from '@core/api/user.api';
import { AuthUser } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class UserRepository {
  private readonly api = inject(UserApiService);

  private readonly _users = signal<AuthUser[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly users = computed(() => this._users());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadUsers(params?: any): Observable<AuthUser[]> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getUsers(params).pipe(
      tap((data) => {
        this._users.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load users');
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  loadUserById(id: string): Observable<AuthUser> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getUserById(id).pipe(
      tap(() => this._loading.set(false)),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load user details');
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  createUser(user: Partial<AuthUser>): Observable<AuthUser> {
    this._loading.set(true);
    return this.api.createUser(user).pipe(
      tap((newUser) => {
        this._users.update((current) => [...current, newUser]);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  updateUser(id: string, user: Partial<AuthUser>): Observable<AuthUser> {
    this._loading.set(true);
    return this.api.updateUser(id, user).pipe(
      tap((updatedUser) => {
        this._users.update((current) =>
          current.map((u) => (u.id === id ? { ...u, ...updatedUser } : u))
        );
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  deleteUser(id: string): Observable<void> {
    this._loading.set(true);
    return this.api.deleteUser(id).pipe(
      tap(() => {
        this._users.update((current) => current.filter((u) => u.id !== id));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }
}
