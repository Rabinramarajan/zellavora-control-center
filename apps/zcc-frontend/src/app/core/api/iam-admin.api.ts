import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope, PaginatedList } from '../../shared/models/iam.model';
import {
  CatalogPermission,
  CatalogPermissionDetail,
  CatalogPermissionList,
  ConfigurationItem,
  CreateCatalogPermissionRequest,
  DeliverySummary,
  BranchItem,
  DepartmentDetail,
  DepartmentItem,
  LoginPolicy,
  MfaCompliance,
  MfaPolicy,
  PasswordPolicy,
  PermissionGroupItem,
  SaveBranchRequest,
  SaveDepartmentRequest,
  SaveTeamRequest,
  SecurityPolicies,
  SendEmailRequest,
  SendMessageRequest,
  SessionItem,
  SessionStats,
  TeamDetail,
  TeamItem,
  UpsertConfigurationRequest,
} from '../../shared/models/iam-admin.model';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

const clean = (params: QueryParams): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)])
  );

/**
 * API client for the IAM console modules beyond users/roles/groups/resources:
 * permission catalog, departments, teams, sessions, security
 * policies, configuration and communications. Every method returns the
 * unwrapped `data` payload.
 */
@Injectable({ providedIn: 'root' })
export class IamAdminApiService {
  private readonly api = inject(ApiDataService);

  private get<T>(path: string, params: QueryParams = {}): Observable<T> {
    return this.api.getData<ApiEnvelope<T>>(path, clean(params)).pipe(map((r) => r.data));
  }
  private post<T>(path: string, body: unknown): Observable<T> {
    return this.api.postData<ApiEnvelope<T>>(path, body).pipe(map((r) => r.data));
  }
  private put<T>(path: string, body: unknown): Observable<T> {
    return this.api.putData<ApiEnvelope<T>>(path, body).pipe(map((r) => r.data));
  }
  private delete<T>(path: string): Observable<T> {
    return this.api.deleteData<ApiEnvelope<T>>(path).pipe(map((r) => r.data));
  }

  // Permission catalog --------------------------------------------------------
  listPermissions(params: QueryParams): Observable<CatalogPermissionList> {
    return this.get('/iam/permissions', params);
  }
  getPermission(id: string): Observable<CatalogPermissionDetail> {
    return this.get(`/iam/permissions/${id}`);
  }
  createPermission(body: CreateCatalogPermissionRequest): Observable<CatalogPermission> {
    return this.post('/iam/permissions', body);
  }
  updatePermission(
    id: string,
    body: { description?: string | null; groupId?: string | null }
  ): Observable<CatalogPermission> {
    return this.put(`/iam/permissions/${id}`, body);
  }
  deletePermission(id: string): Observable<unknown> {
    return this.delete(`/iam/permissions/${id}`);
  }
  listPermissionGroups(): Observable<PermissionGroupItem[]> {
    return this.get('/iam/permissions/groups');
  }
  createPermissionGroup(body: {
    name: string;
    description?: string | null;
  }): Observable<PermissionGroupItem> {
    return this.post('/iam/permissions/groups', body);
  }

  // Departments ---------------------------------------------------------------
  listDepartments(params: QueryParams): Observable<PaginatedList<DepartmentItem>> {
    return this.get('/iam/departments', params);
  }
  getDepartment(id: string): Observable<DepartmentDetail> {
    return this.get(`/iam/departments/${id}`);
  }
  createDepartment(body: SaveDepartmentRequest): Observable<DepartmentDetail> {
    return this.post('/iam/departments', body);
  }
  updateDepartment(id: string, body: Partial<SaveDepartmentRequest>): Observable<DepartmentDetail> {
    return this.put(`/iam/departments/${id}`, body);
  }
  deleteDepartment(id: string): Observable<unknown> {
    return this.delete(`/iam/departments/${id}`);
  }
  addDepartmentMembers(id: string, userIds: string[]): Observable<DepartmentDetail> {
    return this.post(`/iam/departments/${id}/members`, { userIds });
  }
  removeDepartmentMember(id: string, userId: string): Observable<DepartmentDetail> {
    return this.delete(`/iam/departments/${id}/members/${userId}`);
  }

  // Branches ------------------------------------------------------------------
  listBranches(params: QueryParams): Observable<PaginatedList<BranchItem>> {
    return this.get('/branches', params);
  }
  createBranch(body: SaveBranchRequest): Observable<BranchItem> {
    return this.post('/branches', body);
  }
  updateBranch(id: string, body: Partial<SaveBranchRequest>): Observable<BranchItem> {
    return this.put(`/branches/${id}`, body);
  }
  deleteBranch(id: string): Observable<unknown> {
    return this.delete(`/branches/${id}`);
  }

  // Teams ---------------------------------------------------------------------
  listTeams(params: QueryParams): Observable<PaginatedList<TeamItem>> {
    return this.get('/iam/teams', params);
  }
  getTeam(id: string): Observable<TeamDetail> {
    return this.get(`/iam/teams/${id}`);
  }
  createTeam(body: SaveTeamRequest): Observable<TeamDetail> {
    return this.post('/iam/teams', body);
  }
  updateTeam(id: string, body: Partial<SaveTeamRequest>): Observable<TeamDetail> {
    return this.put(`/iam/teams/${id}`, body);
  }
  deleteTeam(id: string): Observable<unknown> {
    return this.delete(`/iam/teams/${id}`);
  }
  addTeamMembers(id: string, userIds: string[]): Observable<TeamDetail> {
    return this.post(`/iam/teams/${id}/members`, { userIds });
  }
  removeTeamMember(id: string, userId: string): Observable<TeamDetail> {
    return this.delete(`/iam/teams/${id}/members/${userId}`);
  }

  // Sessions ------------------------------------------------------------------
  listSessions(params: QueryParams): Observable<PaginatedList<SessionItem>> {
    return this.get('/iam/sessions', params);
  }
  getSessionStats(): Observable<SessionStats> {
    return this.get('/iam/sessions/stats');
  }
  revokeSession(id: string): Observable<unknown> {
    return this.delete(`/iam/sessions/${id}`);
  }
  revokeUserSessions(userId: string): Observable<{ revoked: number }> {
    return this.delete(`/iam/sessions/users/${userId}`);
  }

  // Security policies ---------------------------------------------------------
  getSecurityPolicies(): Observable<SecurityPolicies> {
    return this.get('/iam/security/policies');
  }
  updatePasswordPolicy(body: PasswordPolicy): Observable<PasswordPolicy> {
    return this.put('/iam/security/policies/password', body);
  }
  updateLoginPolicy(body: LoginPolicy): Observable<LoginPolicy> {
    return this.put('/iam/security/policies/login', body);
  }
  updateMfaPolicy(body: MfaPolicy): Observable<MfaPolicy> {
    return this.put('/iam/security/policies/mfa', body);
  }
  getMfaCompliance(params: QueryParams): Observable<MfaCompliance> {
    return this.get('/iam/security/mfa/compliance', params);
  }

  // Configuration -------------------------------------------------------------
  upsertConfiguration(body: UpsertConfigurationRequest): Observable<ConfigurationItem> {
    return this.put('/iam/configurations', body);
  }
  deleteConfiguration(key: string): Observable<unknown> {
    return this.delete(`/iam/configurations/${encodeURIComponent(key)}`);
  }

  // Communications ------------------------------------------------------------
  sendMessage(body: SendMessageRequest): Observable<DeliverySummary> {
    return this.post('/iam/communications/messages', body);
  }
  sendEmail(body: SendEmailRequest): Observable<DeliverySummary> {
    return this.post('/iam/communications/emails', body);
  }
}
