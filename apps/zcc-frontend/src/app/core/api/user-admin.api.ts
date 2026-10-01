import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope, IamUserListItem, PaginatedList, UserStatus } from '../../shared/models/iam.model';
import {
  UpdateUserProfile,
  UserAccess,
  UserAuditItem,
  UserEmailItem,
  UserNoteItem,
  UserProfile,
  UserRequestHistoryItem,
  UserSession,
  UserStatusHistoryItem,
} from '../../shared/models/user-admin.model';

export type UserSearchQuery = Record<string, string | number | string[] | null | undefined>;

const clean = (params: UserSearchQuery): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params)
      .filter(
        ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)
      )
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])
  );

export type UserSecurityAction =
  | 'password-reset'
  | 'require-password-change'
  | 'reset-mfa'
  | 'resend-invitation'
  | 'cancel-invitation';

/** User Search and User Details endpoints (`/iam/users`). Every method returns the unwrapped data. */
@Injectable({ providedIn: 'root' })
export class UserAdminApiService {
  private readonly api = inject(ApiDataService);

  private get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.api.getData<ApiEnvelope<T>>(`/iam/users${path}`, params).pipe(map((r) => r.data));
  }

  search(query: UserSearchQuery): Observable<PaginatedList<IamUserListItem>> {
    return this.get('', clean(query));
  }
  stats(): Observable<{ total: number; byStatus: Record<string, number> }> {
    return this.get('/stats');
  }
  profile(id: string): Observable<UserProfile> {
    return this.get(`/${id}/profile`);
  }
  updateProfile(id: string, body: UpdateUserProfile): Observable<UserProfile> {
    return this.api
      .patchData<ApiEnvelope<UserProfile>>(`/iam/users/${id}/profile`, body)
      .pipe(map((r) => r.data));
  }
  access(id: string): Observable<UserAccess> {
    return this.get(`/${id}/access`);
  }
  sessions(id: string): Observable<UserSession[]> {
    return this.get(`/${id}/sessions`);
  }
  revokeSession(id: string, sessionId: string): Observable<UserSession[]> {
    return this.api
      .deleteData<ApiEnvelope<UserSession[]>>(`/iam/users/${id}/sessions/${sessionId}`)
      .pipe(map((r) => r.data));
  }
  revokeAllSessions(id: string): Observable<{ revoked: number; sessions: UserSession[] }> {
    return this.api
      .deleteData<ApiEnvelope<{ revoked: number; sessions: UserSession[] }>>(
        `/iam/users/${id}/sessions`
      )
      .pipe(map((r) => r.data));
  }
  notes(id: string): Observable<UserNoteItem[]> {
    return this.get(`/${id}/notes`);
  }
  addNote(
    id: string,
    body: { body: string; noteType: string; visibility: string; attachmentUrl: string | null }
  ): Observable<UserNoteItem[]> {
    return this.api
      .postData<ApiEnvelope<UserNoteItem[]>>(`/iam/users/${id}/notes`, body)
      .pipe(map((r) => r.data));
  }
  requests(id: string): Observable<UserRequestHistoryItem[]> {
    return this.get(`/${id}/requests`);
  }
  statusHistory(id: string): Observable<UserStatusHistoryItem[]> {
    return this.get(`/${id}/status-history`);
  }
  emails(id: string): Observable<UserEmailItem[]> {
    return this.get(`/${id}/emails`);
  }
  audit(id: string): Observable<UserAuditItem[]> {
    return this.get(`/${id}/audit`);
  }
  securityAction(
    id: string,
    action: UserSecurityAction,
    reason?: string | null
  ): Observable<UserProfile> {
    return this.api
      .postData<ApiEnvelope<UserProfile>>(`/iam/users/${id}/${action}`, reason ? { reason } : {})
      .pipe(map((r) => r.data));
  }
  setStatus(id: string, status: UserStatus, reason?: string | null): Observable<unknown> {
    return this.api.putData(`/iam/users/${id}/status`, { status, reason: reason || null });
  }
  lock(id: string, reason?: string | null): Observable<unknown> {
    return this.api.postData(`/iam/users/${id}/lock`, { reason: reason || null });
  }
  unlock(id: string): Observable<unknown> {
    return this.api.postData(`/iam/users/${id}/unlock`, {});
  }
  setRoles(id: string, roleIds: string[], mode: 'replace' | 'merge'): Observable<unknown> {
    return this.api.putData(`/iam/users/${id}/roles`, { roleIds, mode });
  }
  setGroups(id: string, groupIds: string[], mode: 'replace' | 'merge'): Observable<unknown> {
    return this.api.putData(`/iam/users/${id}/groups`, { groupIds, mode });
  }
}
