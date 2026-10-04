import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope } from '../../shared/models/iam.model';
import {
  AccessPreview,
  SaveUserRequest,
  UserRequestAuditEntry,
  UserRequestDetail,
  UserRequestLookups,
  UserRequestPayload,
  UserRequestType,
} from '../../shared/models/user-request.model';

/** API client for the IAM user request workflow (`/iam/user-requests`). */
@Injectable({ providedIn: 'root' })
export class UserRequestsApiService {
  private readonly api = inject(ApiDataService);
  private readonly base = '/iam/user-requests';

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.api.postData<ApiEnvelope<T>>(`${this.base}${path}`, body).pipe(map((r) => r.data));
  }

  lookups(): Observable<UserRequestLookups> {
    return this.api
      .getData<ApiEnvelope<UserRequestLookups>>(`${this.base}/lookups`)
      .pipe(map((r) => r.data));
  }
  get(id: string): Observable<UserRequestDetail> {
    return this.api
      .getData<ApiEnvelope<UserRequestDetail>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }
  access(id: string): Observable<AccessPreview> {
    return this.api
      .getData<ApiEnvelope<AccessPreview>>(`${this.base}/${id}/access`)
      .pipe(map((r) => r.data));
  }
  audit(id: string): Observable<UserRequestAuditEntry[]> {
    return this.api
      .getData<ApiEnvelope<UserRequestAuditEntry[]>>(`${this.base}/${id}/audit`)
      .pipe(map((r) => r.data));
  }
  preview(body: {
    type: UserRequestType;
    targetUserId: string | null;
    payload: UserRequestPayload;
  }): Observable<AccessPreview> {
    return this.post('/access-preview', body);
  }
  create(body: SaveUserRequest): Observable<UserRequestDetail> {
    return this.post('', body);
  }
  update(id: string, body: SaveUserRequest): Observable<UserRequestDetail> {
    return this.api
      .patchData<ApiEnvelope<UserRequestDetail>>(`${this.base}/${id}`, body)
      .pipe(map((r) => r.data));
  }
  action(
    id: string,
    action: 'submit' | 'approve' | 'reject' | 'send-back' | 'cancel' | 'retry-provisioning',
    comments?: string | null
  ): Observable<UserRequestDetail> {
    return this.post(`/${id}/${action}`, comments ? { comments } : {});
  }
  setApprovalProvisioning(
    id: string,
    body: { branchId: string; departmentId: string; roleIds: string[] }
  ): Observable<UserRequestDetail> {
    return this.api
      .putData<ApiEnvelope<UserRequestDetail>>(`${this.base}/${id}/approval-provisioning`, body)
      .pipe(map((r) => r.data));
  }
  addNote(
    id: string,
    body: { body: string; noteType: string; visibility: string; attachmentUrl: string | null }
  ): Observable<UserRequestDetail> {
    return this.post(`/${id}/notes`, body);
  }
  retryEmail(id: string, emailId: string): Observable<UserRequestDetail> {
    return this.post(`/${id}/emails/${emailId}/retry`, {});
  }
}
