import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { DateControl, FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { UserAdminApiService } from '../../../core/api/user-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { UserRequestsApiService } from '../../../core/api/user-requests.api';
import {
  UpdateUserProfile,
  UserAccess,
  UserAction,
  UserAuditItem,
  UserEmailItem,
  UserNoteItem,
  UserProfile,
  UserRequestHistoryItem,
  UserSession,
  UserStatusHistoryItem,
} from '../../../shared/models/user-admin.model';
import { UserRequestLookups } from '../../../shared/models/user-request.model';
import {
  ChipTone,
  EmptyStateComponent,
  JsonDiffViewerComponent,
  StatusChipComponent,
} from '../../../shared/components/iam';
import { IAM_BTN, IAM_CARD, IAM_INPUT } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { formatDate, formatDateTime, initials } from '../shared/iam-format';
import { ACTION_META, StateAction, UserActionsService } from '../../users/user-actions';
import { UserSelectComponent } from '../user-requests/components/user-select.component';

type SectionKey =
  | 'overview'
  | 'personal'
  | 'employee'
  | 'contact'
  | 'organization'
  | 'groups'
  | 'roles'
  | 'security'
  | 'sessions'
  | 'notes'
  | 'requests'
  | 'status'
  | 'emails'
  | 'audit';

type EditableSection = 'personal' | 'employee' | 'contact' | 'organization';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: 'overview', label: 'Overview', icon: 'pi pi-th-large' },
  { key: 'personal', label: 'Personal Details', icon: 'pi pi-user' },
  { key: 'employee', label: 'Employee Details', icon: 'pi pi-id-card' },
  { key: 'contact', label: 'Contact Details', icon: 'pi pi-phone' },
  { key: 'organization', label: 'Organization', icon: 'pi pi-sitemap' },
  { key: 'groups', label: 'Groups', icon: 'pi pi-users' },
  { key: 'roles', label: 'Roles & Permissions', icon: 'pi pi-key' },
  { key: 'security', label: 'Security', icon: 'pi pi-shield' },
  { key: 'sessions', label: 'Sessions', icon: 'pi pi-desktop' },
  { key: 'notes', label: 'Notes', icon: 'pi pi-comment' },
  { key: 'requests', label: 'Request History', icon: 'pi pi-inbox' },
  { key: 'status', label: 'Status History', icon: 'pi pi-history' },
  { key: 'emails', label: 'Email History', icon: 'pi pi-envelope' },
  { key: 'audit', label: 'Audit', icon: 'pi pi-list' },
];

const STATUS_TONES: Record<string, ChipTone> = {
  INVITED: 'amber',
  PENDING_VERIFICATION: 'amber',
  ACTIVE: 'green',
  INACTIVE: 'gray',
  LOCKED: 'red',
  SUSPENDED: 'rose',
  DISABLED: 'gray',
};

const USER_TYPES: SelectControlOption[] = [
  { value: '', label: 'Not set' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'EXTERNAL', label: 'External' },
];
const EMPLOYMENT_TYPES: SelectControlOption[] = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'EXTERNAL', label: 'External' },
];
const ACCESS_SCOPES: SelectControlOption[] = [
  { value: '', label: 'Role default' },
  { value: 'GLOBAL', label: 'Global' },
  { value: 'ORGANIZATION', label: 'Organization' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'TEAM', label: 'Team' },
  { value: 'OWN', label: 'Own Records' },
];
const LANGUAGES: SelectControlOption[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'Tamil' },
  { value: 'hi', label: 'Hindi' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
];
const NOTE_TYPES: SelectControlOption[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'ACCESS', label: 'Access' },
  { value: 'HR', label: 'HR' },
];
const NOTE_VISIBILITY: SelectControlOption[] = [
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'ADMINS', label: 'IAM admins only' },
];

const labelOf = (options: SelectControlOption[], value: string | null | undefined) =>
  value ? (options.find((o) => o.value === value)?.label ?? value) : null;

interface Field {
  label: string;
  value: string | null | undefined;
}

/** Field definitions for the editable sections; `key` is the PATCH field name. */
interface EditField {
  key: string;
  label: string;
  kind: 'text' | 'email' | 'tel' | 'date' | 'select' | 'user';
  options?: () => SelectControlOption[];
  required?: boolean;
  maxLength?: number;
  hint?: string;
}

@Component({
  selector: 'zcc-users-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormInputControl,
    SelectControl,
    DateControl,
    StatusChipComponent,
    EmptyStateComponent,
    JsonDiffViewerComponent,
    UserSelectComponent,
  ],
  host: { '(document:click)': 'moreOpen.set(false)' },
  template: `
    @if (loadError()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Unable to load user"
        [message]="loadError()!"
      />
    } @else if (!user()) {
      <div class="space-y-3">
        <div class="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        <div class="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
      </div>
    } @else {
      @let u = user()!;
      <header [class]="card + ' mb-5 !p-4 sm:!p-5'">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <a routerLink="/iam/users" [class]="btn.icon" aria-label="Back to users" title="Back">
              <i class="pi pi-arrow-left" aria-hidden="true"></i>
            </a>
            @if (u.avatarUrl) {
              <img
                [src]="u.avatarUrl"
                alt=""
                class="size-14 shrink-0 rounded-2xl object-cover"
                width="56"
                height="56"
              />
            } @else {
              <span
                class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-lg font-bold text-indigo-500"
                aria-hidden="true"
              >
                {{ initials(u.personal.fullName) }}
              </span>
            }
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="truncate text-xl font-bold text-gray-900 dark:text-white">
                  {{ u.personal.fullName }}
                </h1>
                <zcc-status-chip
                  [value]="u.accountStatus"
                  [label]="u.statusLabel"
                  [tone]="statusTone()"
                />
              </div>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                <span class="font-mono">{{ u.userCode ?? '—' }}</span>
                @if (u.employee.employeeCode) {
                  · <span class="font-mono">{{ u.employee.employeeCode }}</span>
                }
                @if (u.personal.username) {
                  · {{ u.personal.username }}
                }
              </p>
              <p class="truncate text-sm text-gray-500 dark:text-gray-400">
                {{ u.contact.workEmail }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            @if (can('edit')) {
              <button type="button" [class]="btn.secondary" (click)="startEdit('personal')">
                <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                Edit
              </button>
            }
            @if (can('manageAccess')) {
              <button type="button" [class]="btn.primary" (click)="go('groups')">
                <i class="pi pi-key text-xs" aria-hidden="true"></i>
                Manage Access
              </button>
            }
            <div class="relative">
              <button
                type="button"
                [class]="btn.secondary"
                aria-haspopup="menu"
                [attr.aria-expanded]="moreOpen()"
                [disabled]="busy()"
                (click)="$event.stopPropagation(); moreOpen.set(!moreOpen())"
              >
                More
                <i class="pi pi-chevron-down text-xs" aria-hidden="true"></i>
              </button>
              @if (moreOpen()) {
                <div
                  role="menu"
                  class="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-gray-900"
                  (click)="$event.stopPropagation()"
                >
                  @for (a of stateActions(); track a) {
                    <button
                      type="button"
                      role="menuitem"
                      [class]="menuItem"
                      [class.!text-red-500]="meta(a).danger"
                      (click)="runAction(a)"
                    >
                      <i [class]="meta(a).icon + ' text-xs'" aria-hidden="true"></i>
                      {{ meta(a).label }}
                    </button>
                  }
                  @if (can('manageAccess')) {
                    <button
                      type="button"
                      role="menuitem"
                      [class]="menuItem"
                      (click)="requestChange()"
                    >
                      <i class="pi pi-inbox text-xs" aria-hidden="true"></i>
                      Request Access Change
                    </button>
                  }
                  @if (u.latestRequest) {
                    <a
                      role="menuitem"
                      [class]="menuItem"
                      [routerLink]="['/iam/user-requests', u.latestRequest.id]"
                    >
                      <i class="pi pi-external-link text-xs" aria-hidden="true"></i>
                      View Request {{ u.latestRequest.refNo }}
                    </a>
                  }
                  <button type="button" role="menuitem" [class]="menuItem" (click)="go('status')">
                    <i class="pi pi-history text-xs" aria-hidden="true"></i>
                    View History
                  </button>
                  <button type="button" role="menuitem" [class]="menuItem" (click)="go('audit')">
                    <i class="pi pi-list text-xs" aria-hidden="true"></i>
                    View Audit
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        <dl
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-5 dark:border-white/5"
          aria-label="User summary"
        >
          @for (f of summary(); track f.label) {
            <div class="min-w-0">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ f.label }}</dt>
              <dd
                class="truncate font-medium text-gray-900 dark:text-white"
                [title]="f.value ?? ''"
              >
                {{ f.value || '—' }}
              </dd>
            </div>
          }
        </dl>
      </header>

      @if (u.accountStatus === 'INVITED' && u.pendingInvitation) {
        <div
          role="status"
          class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
        >
          Invitation sent {{ dateTime(u.pendingInvitation.sentAt) }} · expires
          {{ dateTime(u.pendingInvitation.expiresAt) }}.
        </div>
      }
      @if (u.security.passwordResetRequired) {
        <div
          role="status"
          class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
        >
          A password change is required before this user can sign in again.
        </div>
      }

      <div class="flex flex-col gap-5 lg:flex-row">
        <nav aria-label="User sections" class="lg:w-56 lg:shrink-0">
          <ul class="flex gap-1 overflow-x-auto lg:sticky lg:top-4 lg:flex-col">
            @for (s of sections; track s.key) {
              <li class="shrink-0">
                <button
                  type="button"
                  class="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium transition-colors"
                  [class]="
                    section() === s.key
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  "
                  [attr.aria-current]="section() === s.key ? 'page' : null"
                  (click)="go(s.key)"
                >
                  <i [class]="s.icon + ' text-xs'" aria-hidden="true"></i>
                  {{ s.label }}
                </button>
              </li>
            }
          </ul>
        </nav>

        <section [class]="card + ' min-w-0 flex-1'" [attr.aria-label]="sectionLabel()">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ sectionLabel() }}
            </h2>
            @if (isEditable(section()) && can('edit') && editing() !== section()) {
              <button type="button" [class]="btn.secondary" (click)="startEdit($any(section()))">
                <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                Edit
              </button>
            }
          </div>

          @switch (section()) {
            @case ('overview') {
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                @for (group of overview(); track group.title) {
                  <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                    <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      {{ group.title }}
                    </h3>
                    <dl class="space-y-2 text-sm">
                      @for (f of group.fields; track f.label) {
                        <div class="flex justify-between gap-4">
                          <dt class="text-gray-500 dark:text-gray-400">{{ f.label }}</dt>
                          <dd class="text-right font-medium text-gray-900 dark:text-white">
                            {{ f.value || '—' }}
                          </dd>
                        </div>
                      }
                    </dl>
                  </div>
                }
              </div>
            }

            @case ('groups') {
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Prefer User → Group → Role → Permission over direct role assignments.
                </p>
                @if (can('manageAccess')) {
                  <button
                    type="button"
                    [class]="btn.primary"
                    [disabled]="busy()"
                    (click)="assignGroups()"
                  >
                    <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                    Assign Group
                  </button>
                }
              </div>
              @if (access()?.groups?.length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr [class]="theadRow">
                        @for (
                          h of [
                            'Group',
                            'Type',
                            'Roles Inherited',
                            'Scope',
                            'Assigned On',
                            'Assigned By',
                            '',
                          ];
                          track $index
                        ) {
                          <th scope="col" [class]="th">{{ h }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (g of access()!.groups; track g.groupId) {
                        <tr>
                          <td [class]="td + ' font-medium text-gray-900 dark:text-white'">
                            {{ g.name }}
                          </td>
                          <td [class]="td">{{ humanize(g.type) }}</td>
                          <td [class]="td + ' tabular-nums'">{{ g.rolesInherited }}</td>
                          <td [class]="td">{{ g.scope }}</td>
                          <td [class]="td">{{ date(g.assignedOn) }}</td>
                          <td [class]="td">{{ g.assignedBy }}</td>
                          <td [class]="td + ' text-right'">
                            @if (can('manageAccess')) {
                              <button
                                type="button"
                                [class]="linkDanger"
                                [disabled]="busy()"
                                (click)="removeGroup(g.groupId, g.name)"
                              >
                                Remove
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else if (!accessLoading()) {
                <p class="text-sm text-gray-500">Not a member of any group.</p>
              }
            }

            @case ('roles') {
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Assigned Roles</h3>
                <div class="flex gap-2">
                  @if (can('manageAccess')) {
                    <button type="button" [class]="btn.secondary" (click)="requestChange()">
                      <i class="pi pi-inbox text-xs" aria-hidden="true"></i>
                      Request Change
                    </button>
                    <button
                      type="button"
                      [class]="btn.primary"
                      [disabled]="busy()"
                      (click)="assignRoles()"
                    >
                      <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                      Assign Role
                    </button>
                  }
                </div>
              </div>
              @if (access()?.roles?.length) {
                <div
                  class="mb-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10"
                >
                  <table class="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr [class]="theadRow">
                        @for (
                          h of [
                            'Role',
                            'Assignment Source',
                            'Scope',
                            'Assigned By',
                            'Assigned On',
                            '',
                          ];
                          track $index
                        ) {
                          <th scope="col" [class]="th">{{ h }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (r of access()!.roles; track r.roleId + r.source) {
                        <tr>
                          <td [class]="td">
                            <span class="font-medium text-gray-900 dark:text-white">{{
                              r.name
                            }}</span>
                            <span class="block font-mono text-[11px] text-gray-400">{{
                              r.key
                            }}</span>
                          </td>
                          <td [class]="td">
                            <zcc-status-chip
                              [value]="r.sourceType"
                              [label]="r.source"
                              [tone]="r.sourceType === 'DIRECT' ? 'purple' : 'blue'"
                            />
                          </td>
                          <td [class]="td">{{ r.scope }}</td>
                          <td [class]="td">{{ r.assignedBy }}</td>
                          <td [class]="td">{{ date(r.assignedOn) }}</td>
                          <td [class]="td + ' text-right'">
                            @if (can('manageAccess') && r.sourceType === 'DIRECT') {
                              <button
                                type="button"
                                [class]="linkDanger"
                                [disabled]="busy()"
                                (click)="removeRole(r.roleId, r.name)"
                              >
                                Remove
                              </button>
                            } @else if (r.sourceType === 'GROUP') {
                              <span
                                class="text-xs text-gray-400"
                                title="Remove the group membership to revoke this role"
                                >Inherited</span
                              >
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else if (!accessLoading()) {
                <p class="mb-6 text-sm text-gray-500">No roles assigned.</p>
              }

              <div class="mb-2 flex flex-wrap items-end justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  Effective Permissions ({{ filteredPermissions().length }})
                </h3>
                <div class="w-full sm:w-64">
                  <app-form-input-control
                    icon="search"
                    placeholder="Filter permissions…"
                    aria-label="Filter permissions"
                    [value]="permissionFilter()"
                    (valueChange)="permissionFilter.set($event)"
                  />
                </div>
              </div>
              <p class="mb-3 text-xs text-gray-400">
                Calculated from direct and group-inherited roles.
              </p>
              @if (filteredPermissions().length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr [class]="theadRow">
                        @for (h of ['Resource', 'Permission', 'Source', 'Scope']; track h) {
                          <th scope="col" [class]="th">{{ h }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (p of filteredPermissions(); track p.key) {
                        <tr>
                          <td [class]="td + ' capitalize'">{{ p.resource }}</td>
                          <td [class]="td">
                            <span class="font-mono text-xs">{{ p.key }}</span>
                          </td>
                          <td [class]="td">{{ p.source }}</td>
                          <td [class]="td">{{ p.scope }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else if (!accessLoading()) {
                <p class="text-sm text-gray-500">No effective permissions.</p>
              }
            }

            @case ('security') {
              <dl class="mb-6 grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
                @for (f of securityFields(); track f.label) {
                  <div class="border-b border-gray-100 pb-2 dark:border-white/5">
                    <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {{ f.label }}
                    </dt>
                    <dd class="mt-0.5 text-gray-900 dark:text-white">{{ f.value || '—' }}</dd>
                  </div>
                }
              </dl>
              <p class="mb-3 text-xs text-gray-400">
                Password hashes, MFA secrets, reset tokens, session tokens and recovery codes are
                never shown.
              </p>
              @if (securityActions().length) {
                <h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Security Actions
                </h3>
                <div class="flex flex-wrap gap-2">
                  @for (a of securityActions(); track a) {
                    <button
                      type="button"
                      [class]="meta(a).danger ? btn.danger : btn.secondary"
                      [disabled]="busy()"
                      (click)="runAction(a)"
                    >
                      <i [class]="meta(a).icon + ' text-xs'" aria-hidden="true"></i>
                      {{ meta(a).label }}
                    </button>
                  }
                </div>
              }
            }

            @case ('sessions') {
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs text-gray-400">
                  Location is not resolved from IP addresses; the IP shown is approximate network
                  information only.
                </p>
                @if (can('revokeSessions') && sessions().length) {
                  <button
                    type="button"
                    [class]="btn.danger"
                    [disabled]="busy()"
                    (click)="revokeAll()"
                  >
                    <i class="pi pi-sign-out text-xs" aria-hidden="true"></i>
                    {{ hasCurrentSession() ? 'Revoke All Other Sessions' : 'Revoke All Sessions' }}
                  </button>
                }
              </div>
              @if (sessions().length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr [class]="theadRow">
                        @for (
                          h of [
                            'Device',
                            'Browser',
                            'IP (approx.)',
                            'Login',
                            'Last Activity',
                            'Status',
                            '',
                          ];
                          track $index
                        ) {
                          <th scope="col" [class]="th">{{ h }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (s of sessions(); track s.id) {
                        <tr>
                          <td [class]="td">
                            <i
                              class="pi mr-1 text-xs"
                              [class.pi-mobile]="s.isMobile"
                              [class.pi-desktop]="!s.isMobile"
                              aria-hidden="true"
                            ></i>
                            {{ s.device }}
                          </td>
                          <td [class]="td">{{ s.browser }}</td>
                          <td [class]="td + ' font-mono text-xs'">{{ s.ipAddress ?? '—' }}</td>
                          <td [class]="td">{{ dateTime(s.loginAt) }}</td>
                          <td [class]="td">{{ dateTime(s.lastActivityAt) }}</td>
                          <td [class]="td">
                            <zcc-status-chip
                              [value]="s.isCurrent ? 'current' : 'active'"
                              [label]="s.isCurrent ? 'Current' : 'Active'"
                              [tone]="s.isCurrent ? 'blue' : 'green'"
                            />
                          </td>
                          <td [class]="td + ' text-right'">
                            @if (can('revokeSessions') && !s.isCurrent) {
                              <button
                                type="button"
                                [class]="linkDanger"
                                [disabled]="busy()"
                                (click)="revokeOne(s)"
                              >
                                Revoke
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-sm text-gray-500">No active sessions.</p>
              }
            }

            @case ('notes') {
              @if (canManage()) {
                <form class="mb-6 space-y-3" (submit)="$event.preventDefault(); addNote()">
                  <label
                    for="user-note"
                    class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >Note</label
                  >
                  <textarea
                    id="user-note"
                    rows="3"
                    maxlength="4000"
                    [class]="inputClass"
                    placeholder="Administrative context about this user…"
                    [value]="noteBody()"
                    (input)="noteBody.set($any($event.target).value)"
                  ></textarea>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <app-select-control
                      label="Note Type"
                      [searchable]="false"
                      [options]="noteTypes"
                      [(value)]="noteType"
                    />
                    <app-select-control
                      label="Visibility"
                      [searchable]="false"
                      [options]="noteVisibility"
                      [(value)]="noteVisibilityValue"
                    />
                    <app-form-input-control
                      label="Attachment URL"
                      placeholder="https://…"
                      [(value)]="noteAttachment"
                    />
                  </div>
                  <button
                    type="submit"
                    [class]="btn.primary"
                    [disabled]="busy() || !noteBody().trim()"
                  >
                    <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                    Add Note
                  </button>
                </form>
              }
              <p class="mb-3 text-xs text-gray-400">
                Notes are append-only; earlier notes are never overwritten.
              </p>
              <ul class="space-y-3">
                @for (n of notes(); track n.id) {
                  <li class="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ n.authorName }}
                      </p>
                      <div class="flex gap-1">
                        <zcc-status-chip
                          [value]="n.noteType"
                          [label]="option(noteTypes, n.noteType)"
                          tone="blue"
                        />
                        <zcc-status-chip
                          [value]="n.visibility"
                          [label]="option(noteVisibility, n.visibility)"
                          tone="gray"
                        />
                      </div>
                    </div>
                    <p class="text-xs text-gray-500">{{ dateTime(n.createdAt) }}</p>
                    <p class="mt-2 whitespace-pre-line text-sm text-gray-700 dark:text-gray-200">
                      {{ n.body }}
                    </p>
                    @if (n.attachmentUrl) {
                      <a
                        [href]="n.attachmentUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="mt-1 inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
                      >
                        <i class="pi pi-paperclip text-xs" aria-hidden="true"></i> Attachment
                      </a>
                    }
                  </li>
                } @empty {
                  <li class="text-sm text-gray-500">No notes yet.</li>
                }
              </ul>
            }

            @case ('requests') {
              <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
                The approved requests that explain why this user has their current access.
              </p>
              @if (requests().length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr [class]="theadRow">
                        @for (
                          h of ['Request Ref', 'Type', 'Requested By', 'Date', 'Status'];
                          track h
                        ) {
                          <th scope="col" [class]="th">{{ h }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (r of requests(); track r.id) {
                        <tr>
                          <td [class]="td">
                            <a
                              [routerLink]="['/iam/user-requests', r.id]"
                              class="font-mono font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                              >{{ r.refNo }}</a
                            >
                          </td>
                          <td [class]="td">{{ r.typeLabel }}</td>
                          <td [class]="td">{{ r.requestedBy ?? '—' }}</td>
                          <td [class]="td">{{ date(r.createdAt) }}</td>
                          <td [class]="td">
                            <zcc-status-chip
                              [value]="r.status"
                              [label]="r.statusLabel"
                              [tone]="
                                r.status === 'COMPLETED'
                                  ? 'green'
                                  : r.status === 'REJECTED' || r.status === 'FAILED'
                                    ? 'red'
                                    : 'amber'
                              "
                            />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-sm text-gray-500">No requests reference this user.</p>
              }
            }

            @case ('status') {
              @if (statusHistory().length) {
                <ol class="relative ml-2 border-l border-gray-200 dark:border-white/10">
                  @for (h of statusHistory(); track h.id; let last = $last) {
                    <li class="mb-6 ml-5 last:mb-0">
                      <span
                        class="absolute -left-[7px] mt-1 size-3.5 rounded-full ring-4 ring-white dark:ring-gray-900"
                        [class]="last ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/30'"
                        aria-hidden="true"
                      ></span>
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ h.toLabel }}
                        @if (h.fromLabel) {
                          <span class="font-normal text-gray-400">from {{ h.fromLabel }}</span>
                        }
                      </p>
                      <p class="text-xs text-gray-500">
                        {{ dateTime(h.createdAt) }} · {{ h.actorName }}
                      </p>
                      @if (h.reason) {
                        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ h.reason }}</p>
                      }
                    </li>
                  }
                </ol>
              } @else {
                <p class="text-sm text-gray-500">No status changes recorded yet.</p>
              }
            }

            @case ('emails') {
              @if (emails().length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr [class]="theadRow">
                        @for (
                          h of [
                            'Email ID',
                            'Type',
                            'Recipient',
                            'Subject',
                            'Trigger',
                            'Sent On',
                            'Status',
                          ];
                          track h
                        ) {
                          <th scope="col" [class]="th">{{ h }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (m of emails(); track m.id) {
                        <tr>
                          <td [class]="td + ' font-mono text-[11px] text-gray-500'">
                            {{ m.id.slice(0, 8).toUpperCase() }}
                          </td>
                          <td [class]="td">{{ humanize(m.type) }}</td>
                          <td [class]="td">{{ m.recipient }}</td>
                          <td [class]="td + ' text-gray-900 dark:text-white'">{{ m.subject }}</td>
                          <td [class]="td">
                            {{ m.trigger }}
                            @if (m.requestRef) {
                              <span class="block text-[11px] text-gray-400">{{
                                m.requestRef
                              }}</span>
                            }
                          </td>
                          <td [class]="td">{{ dateTime(m.sentOn) }}</td>
                          <td [class]="td">
                            <zcc-status-chip
                              [value]="m.deliveryStatus"
                              [label]="humanize(m.deliveryStatus)"
                              [tone]="
                                m.deliveryStatus === 'FAILED'
                                  ? 'red'
                                  : m.deliveryStatus === 'QUEUED'
                                    ? 'gray'
                                    : 'green'
                              "
                            />
                            @if (m.lastError) {
                              <p
                                class="mt-0.5 max-w-[180px] truncate text-[11px] text-red-500"
                                [title]="m.lastError"
                              >
                                {{ m.lastError }}
                              </p>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-sm text-gray-500">No emails have been sent to this user.</p>
              }
            }

            @case ('audit') {
              <p class="mb-3 text-xs text-gray-400">Audit records are read-only.</p>
              <ul class="space-y-2">
                @for (a of audit(); track a.id) {
                  <li class="rounded-lg border border-gray-200 dark:border-white/10">
                    <button
                      type="button"
                      class="flex min-h-[44px] w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left text-sm"
                      [attr.aria-expanded]="openAudit() === a.id"
                      (click)="openAudit.set(openAudit() === a.id ? null : a.id)"
                    >
                      <span class="font-mono text-xs text-gray-500">{{
                        dateTime(a.timestamp)
                      }}</span>
                      <span class="font-medium text-gray-900 dark:text-white">{{
                        auditLabel(a.action)
                      }}</span>
                      <span class="text-gray-600 dark:text-gray-300">{{ a.actor }}</span>
                      <span class="text-gray-500">{{ a.module }}</span>
                      <zcc-status-chip
                        class="ml-auto"
                        [value]="a.result"
                        [label]="a.result"
                        [tone]="a.result === 'Success' ? 'green' : 'red'"
                      />
                    </button>
                    @if (openAudit() === a.id) {
                      <div
                        class="space-y-2 border-t border-gray-100 px-3 py-3 text-xs dark:border-white/5"
                      >
                        <p class="text-gray-500">
                          Correlation: <span class="font-mono">{{ a.correlationId ?? '—' }}</span> ·
                          IP: {{ a.ipAddress ?? '—' }}
                        </p>
                        @if (a.before || a.after) {
                          <zcc-json-diff-viewer [before]="a.before" [after]="a.after" />
                        }
                      </div>
                    }
                  </li>
                } @empty {
                  <li class="text-sm text-gray-500">No audit entries.</li>
                }
              </ul>
            }

            @default {
              @if (editing() === section()) {
                <form (submit)="$event.preventDefault(); saveEdit()" novalidate>
                  @if (editErrors().length) {
                    <div
                      role="alert"
                      class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
                    >
                      <ul class="list-inside list-disc">
                        @for (e of editErrors(); track e) {
                          <li>{{ e }}</li>
                        }
                      </ul>
                    </div>
                  }
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    @for (f of editFields(); track f.key) {
                      @switch (f.kind) {
                        @case ('select') {
                          <app-select-control
                            [label]="f.label"
                            [required]="!!f.required"
                            [hint]="f.hint ?? ''"
                            [options]="f.options!()"
                            [value]="draft()[f.key]"
                            (valueChange)="patchDraft(f.key, $event)"
                          />
                        }
                        @case ('user') {
                          <div>
                            <label
                              [for]="'edit-' + f.key"
                              class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                              >{{ f.label }}</label
                            >
                            <zcc-user-select
                              [inputId]="'edit-' + f.key"
                              [initialLabel]="personName(draft()[f.key])"
                              [value]="draft()[f.key] || null"
                              (valueChange)="patchDraft(f.key, $event ?? '')"
                            />
                          </div>
                        }
                        @case ('date') {
                          <app-date-control
                            [label]="f.label"
                            [value]="draft()[f.key]"
                            (valueChange)="patchDraft(f.key, $event)"
                          />
                        }
                        @default {
                          <app-form-input-control
                            [label]="f.label"
                            [type]="f.kind"
                            [required]="!!f.required"
                            [hint]="f.hint ?? ''"
                            [maxLength]="f.maxLength"
                            [value]="draft()[f.key]"
                            (valueChange)="patchDraft(f.key, $event)"
                          />
                        }
                      }
                    }
                  </div>
                  <div
                    class="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5"
                  >
                    <button
                      type="button"
                      [class]="btn.secondary"
                      [disabled]="busy()"
                      (click)="cancelEdit()"
                    >
                      Cancel
                    </button>
                    <button type="submit" [class]="btn.primary" [disabled]="busy()">
                      <i class="pi pi-check text-xs" aria-hidden="true"></i>
                      Save Changes
                    </button>
                  </div>
                </form>
              } @else {
                <dl class="grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2">
                  @for (f of viewFields(); track f.label) {
                    <div class="border-b border-gray-100 pb-2 dark:border-white/5">
                      <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {{ f.label }}
                      </dt>
                      <dd class="mt-0.5 break-words text-gray-900 dark:text-white">
                        {{ f.value || '—' }}
                      </dd>
                    </div>
                  }
                </dl>
              }
            }
          }
        </section>
      </div>
    }
  `,
})
export class UsersDetailComponent {
  private readonly api = inject(UserAdminApiService);
  private readonly requestsApi = inject(UserRequestsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly actions = inject(UserActionsService);

  private readonly userId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });
  private readonly query = toSignal(this.route.queryParamMap);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly theadRow =
    'border-b border-gray-200 bg-gray-50/80 text-left dark:border-white/10 dark:bg-white/5';
  protected readonly th = 'px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300';
  protected readonly td = 'px-4 py-2.5 text-gray-600 dark:text-gray-300';
  protected readonly linkDanger =
    'rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-40';
  protected readonly menuItem =
    'flex min-h-[40px] w-full items-center gap-2 rounded-md px-3 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5';
  protected readonly sections = SECTIONS;
  protected readonly noteTypes = NOTE_TYPES;
  protected readonly noteVisibility = NOTE_VISIBILITY;
  protected readonly initials = initials;
  protected readonly date = formatDate;
  protected readonly dateTime = formatDateTime;

  protected readonly user = signal<UserProfile | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly section = signal<SectionKey>('overview');
  protected readonly busy = signal(false);
  protected readonly moreOpen = signal(false);
  protected readonly access = signal<UserAccess | null>(null);
  protected readonly accessLoading = signal(false);
  protected readonly sessions = signal<UserSession[]>([]);
  protected readonly notes = signal<UserNoteItem[]>([]);
  protected readonly requests = signal<UserRequestHistoryItem[]>([]);
  protected readonly statusHistory = signal<UserStatusHistoryItem[]>([]);
  protected readonly emails = signal<UserEmailItem[]>([]);
  protected readonly audit = signal<UserAuditItem[]>([]);
  protected readonly openAudit = signal<string | null>(null);
  protected readonly permissionFilter = signal('');
  protected readonly lookups = signal<UserRequestLookups | null>(null);

  protected readonly editing = signal<EditableSection | null>(null);
  protected readonly draft = signal<Record<string, string>>({});
  protected readonly editErrors = signal<string[]>([]);

  protected readonly noteBody = signal('');
  protected noteType = 'GENERAL';
  protected noteVisibilityValue = 'INTERNAL';
  protected noteAttachment = '';

  protected readonly canManage = inject(PermissionService).can('users:manage');
  protected readonly statusTone = computed(
    () => STATUS_TONES[this.user()?.accountStatus ?? ''] ?? 'gray'
  );
  protected readonly sectionLabel = computed(
    () => SECTIONS.find((s) => s.key === this.section())?.label ?? ''
  );
  protected readonly hasCurrentSession = computed(() => this.sessions().some((s) => s.isCurrent));

  /** Actions shown in the More menu / Security tab (navigation ones have their own buttons). */
  protected readonly stateActions = computed(() =>
    (this.user()?.actions ?? []).filter(
      (a): a is StateAction => a !== 'edit' && a !== 'manageAccess'
    )
  );
  protected readonly securityActions = computed(() =>
    this.stateActions().filter((a) =>
      [
        'sendPasswordReset',
        'requirePasswordChange',
        'lock',
        'unlock',
        'resetMfa',
        'revokeSessions',
      ].includes(a)
    )
  );

  protected readonly summary = computed<Field[]>(() => {
    const u = this.user();
    if (!u) return [];
    const primaryRole = this.access()?.roles[0]?.name;
    return [
      { label: 'Branch', value: u.organization.branch?.name },
      { label: 'Department', value: u.organization.department?.name },
      { label: 'Team', value: u.organization.team?.name },
      { label: 'Role', value: primaryRole },
      {
        label: 'Last Login',
        value: u.lastLoginDatetime ? formatDateTime(u.lastLoginDatetime) : 'Never',
      },
    ];
  });

  protected readonly overview = computed(() => {
    const u = this.user();
    if (!u) return [];
    const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
    return [
      {
        title: 'Account',
        fields: [
          { label: 'Status', value: u.statusLabel },
          { label: 'User Type', value: labelOf(USER_TYPES, u.personal.userType) },
          { label: 'Created On', value: formatDate(u.createdAt) },
          {
            label: 'Last Login',
            value: u.lastLoginDatetime ? formatDateTime(u.lastLoginDatetime) : 'Never',
          },
        ],
      },
      {
        title: 'Organization',
        fields: [
          { label: 'Branch', value: u.organization.branch?.name },
          { label: 'Department', value: u.organization.department?.name },
          { label: 'Team', value: u.organization.team?.name },
          { label: 'Manager', value: u.organization.reportingManager?.name },
        ],
      },
      {
        title: 'Access',
        fields: [
          { label: 'Groups', value: String(u.counts.groups) },
          { label: 'Roles', value: String(u.counts.roles) },
          { label: 'Effective Permissions', value: String(u.counts.effectivePermissions) },
          { label: 'Requests', value: String(u.counts.requests) },
        ],
      },
      {
        title: 'Security',
        fields: [
          { label: 'Email', value: u.security.emailVerified ? 'Verified' : 'Unverified' },
          { label: 'MFA', value: u.security.mfaEnabled ? 'Enabled' : 'Disabled' },
          { label: 'Active Sessions', value: String(u.counts.activeSessions) },
          { label: 'Account Locked', value: yesNo(u.security.isAccountLocked) },
        ],
      },
    ];
  });

  protected readonly securityFields = computed<Field[]>(() => {
    const u = this.user();
    if (!u) return [];
    const s = u.security;
    const at = (v: string | null) => (v ? formatDateTime(v) : null);
    return [
      { label: 'Account Status', value: u.statusLabel },
      { label: 'Email Verification Status', value: s.emailVerified ? 'Verified' : 'Unverified' },
      { label: 'Email Verified On', value: at(s.emailVerifiedAt) },
      { label: 'MFA Status', value: s.mfaEnabled ? 'Enabled' : 'Disabled' },
      { label: 'MFA Method', value: s.mfaMethod ? this.humanize(s.mfaMethod) : null },
      { label: 'MFA Enabled On', value: at(s.mfaEnrolledAt) },
      { label: 'Account Locked?', value: s.isAccountLocked ? 'Yes' : 'No' },
      { label: 'Locked On', value: at(s.lockedOn) },
      { label: 'Lock Reason', value: s.lockReason },
      { label: 'Failed Login Attempts', value: String(s.failedLoginAttempts) },
      { label: 'Last Failed Login', value: at(s.lastFailedLogin) },
      { label: 'Last Successful Login', value: at(s.lastSuccessfulLogin) },
      {
        label: 'Password Last Changed',
        value: s.hasPassword ? (at(s.passwordChangedAt) ?? 'Unknown') : 'Not set yet',
      },
      { label: 'Password Reset Required?', value: s.passwordResetRequired ? 'Yes' : 'No' },
    ];
  });

  protected readonly viewFields = computed<Field[]>(() => {
    const u = this.user();
    if (!u) return [];
    const { personal: p, employee: e, contact: c, organization: o } = u;
    switch (this.section()) {
      case 'personal':
        return [
          { label: 'User ID', value: u.userCode },
          { label: 'Username', value: p.username },
          { label: 'First Name', value: p.firstName },
          { label: 'Middle Name', value: p.middleName },
          { label: 'Last Name', value: p.lastName },
          { label: 'Display Name', value: p.displayName ?? p.fullName },
          { label: 'User Type', value: labelOf(USER_TYPES, p.userType) },
          { label: 'Preferred Language', value: labelOf(LANGUAGES, p.language) },
          { label: 'Time Zone', value: p.timezone },
        ];
      case 'employee':
        return [
          { label: 'Employee Code', value: e.employeeCode },
          { label: 'Employment Type', value: labelOf(EMPLOYMENT_TYPES, e.employmentType) },
          { label: 'Designation', value: e.designation },
          { label: 'Department', value: o.department?.name },
          { label: 'Joining Date', value: e.joiningDate ? formatDate(e.joiningDate) : null },
          { label: 'Reporting Manager', value: o.reportingManager?.name },
          { label: 'Company / Organization', value: e.company },
          { label: 'Work Location', value: e.workLocation },
          { label: 'Cost Center', value: e.costCenter },
        ];
      case 'contact':
        return [
          { label: 'Work Email', value: c.workEmail },
          { label: 'Primary Contact Number', value: c.mobile },
          { label: 'Alternate Email', value: c.alternateEmail },
          { label: 'Alternate Contact Number', value: c.alternateMobile },
          { label: 'Address Line 1', value: c.addressLine1 },
          { label: 'Address Line 2', value: c.addressLine2 },
          { label: 'City', value: c.city },
          { label: 'State', value: c.state },
          { label: 'Country', value: c.country },
          { label: 'Postal Code', value: c.postalCode },
        ];
      case 'organization':
        return [
          { label: 'Organization', value: o.organization?.name },
          { label: 'Branch', value: o.branch?.name },
          { label: 'Department', value: o.department?.name },
          { label: 'Team', value: o.team?.name },
          { label: 'Reporting Manager', value: o.reportingManager?.name },
          { label: 'Assigned Officer', value: o.assignedOfficer?.name },
          { label: 'Cost Center', value: o.costCenter },
          { label: 'Location', value: o.location },
          { label: 'Access Scope', value: labelOf(ACCESS_SCOPES, o.accessScope) ?? 'Role default' },
        ];
      default:
        return [];
    }
  });

  protected readonly filteredPermissions = computed(() => {
    const q = this.permissionFilter().trim().toLowerCase();
    const perms = this.access()?.permissions ?? [];
    return q
      ? perms.filter((p) => `${p.key} ${p.source} ${p.scope}`.toLowerCase().includes(q))
      : perms;
  });

  private readonly lookupOptions =
    (key: 'branches' | 'departments' | 'teams', empty: string) => (): SelectControlOption[] => [
      { value: '', label: empty },
      ...(this.lookups()?.[key] ?? []).map((i) => ({ value: i.id, label: i.name })),
    ];

  /** Label for a person already on the profile (the typeahead shows it until changed). */
  protected personName(id: string | undefined): string | null {
    const o = this.user()?.organization;
    return [o?.reportingManager, o?.assignedOfficer].find((p) => p && p.id === id)?.name ?? null;
  }

  private readonly EDIT_FIELDS: Record<EditableSection, EditField[]> = {
    personal: [
      {
        key: 'username',
        label: 'Username',
        kind: 'text',
        required: true,
        maxLength: 50,
        hint: 'Unique; lowercase letters, digits, dot, dash, underscore.',
      },
      { key: 'firstName', label: 'First Name', kind: 'text', required: true, maxLength: 100 },
      { key: 'middleName', label: 'Middle Name', kind: 'text', maxLength: 100 },
      { key: 'lastName', label: 'Last Name', kind: 'text', required: true, maxLength: 100 },
      {
        key: 'displayName',
        label: 'Display Name',
        kind: 'text',
        maxLength: 200,
        hint: 'Derived from the name when blank.',
      },
      { key: 'userType', label: 'User Type', kind: 'select', options: () => USER_TYPES },
      {
        key: 'avatarUrl',
        label: 'Profile Image URL',
        kind: 'text',
        maxLength: 1000,
        hint: 'PNG, JPG, WEBP, GIF or SVG link.',
      },
      { key: 'language', label: 'Preferred Language', kind: 'select', options: () => LANGUAGES },
      {
        key: 'timezone',
        label: 'Time Zone',
        kind: 'text',
        maxLength: 64,
        hint: 'IANA name, e.g. Asia/Kolkata.',
      },
    ],
    employee: [
      { key: 'employeeCode', label: 'Employee Code', kind: 'text', required: true, maxLength: 50 },
      {
        key: 'employmentType',
        label: 'Employment Type',
        kind: 'select',
        required: true,
        options: () => EMPLOYMENT_TYPES,
      },
      { key: 'designation', label: 'Designation', kind: 'text', maxLength: 150 },
      { key: 'joiningDate', label: 'Joining Date', kind: 'date' },
      {
        key: 'company',
        label: 'Company / Organization',
        kind: 'text',
        required: true,
        maxLength: 200,
      },
      { key: 'workLocation', label: 'Work Location', kind: 'text', maxLength: 200 },
      { key: 'costCenter', label: 'Cost Center', kind: 'text', maxLength: 50 },
    ],
    contact: [
      {
        key: 'workEmail',
        label: 'Work Email',
        kind: 'email',
        required: true,
        maxLength: 254,
        hint: 'The sign-in identity.',
      },
      { key: 'mobile', label: 'Primary Contact Number', kind: 'tel' },
      { key: 'alternateEmail', label: 'Alternate Email', kind: 'email', maxLength: 254 },
      { key: 'alternateMobile', label: 'Alternate Contact Number', kind: 'tel' },
      { key: 'addressLine1', label: 'Address Line 1', kind: 'text', maxLength: 200 },
      { key: 'addressLine2', label: 'Address Line 2', kind: 'text', maxLength: 200 },
      { key: 'city', label: 'City', kind: 'text', maxLength: 100 },
      { key: 'state', label: 'State', kind: 'text', maxLength: 100 },
      { key: 'country', label: 'Country', kind: 'text', maxLength: 100 },
      { key: 'postalCode', label: 'Postal Code', kind: 'text', maxLength: 20 },
    ],
    organization: [
      {
        key: 'branchId',
        label: 'Branch',
        kind: 'select',
        required: true,
        options: this.lookupOptions('branches', 'Select…'),
      },
      {
        key: 'departmentId',
        label: 'Department',
        kind: 'select',
        required: true,
        options: this.lookupOptions('departments', 'Select…'),
      },
      {
        key: 'teamId',
        label: 'Team',
        kind: 'select',
        options: this.lookupOptions('teams', 'None'),
      },
      { key: 'reportingManagerId', label: 'Reporting Manager', kind: 'user' },
      { key: 'assignedOfficerId', label: 'Assigned Officer', kind: 'user' },
      { key: 'accessScope', label: 'Access Scope', kind: 'select', options: () => ACCESS_SCOPES },
    ],
  };

  protected readonly editFields = computed(() => {
    const s = this.editing();
    return s ? this.EDIT_FIELDS[s] : [];
  });

  constructor() {
    effect(() => {
      const id = this.userId();
      if (id) void this.load(id);
    });
    effect(() => {
      const q = this.query();
      const section = q?.get('section');
      if (section && SECTIONS.some((s) => s.key === section)) {
        this.section.set(section as SectionKey);
        void this.loadSection(section as SectionKey);
      }
      if (q?.get('edit') === '1' && this.isEditable(section ?? '') && this.user()) {
        this.startEdit(section as EditableSection);
      }
    });
    firstValueFrom(this.requestsApi.lookups())
      .then((l) => this.lookups.set(l))
      .catch(() => this.lookups.set(null));
  }

  private async load(id: string): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.api.profile(id)));
      this.loadError.set(null);
      await Promise.all([this.loadAccess(), this.loadSection(this.section())]);
      const q = this.query();
      if (q?.get('edit') === '1' && this.isEditable(this.section())) {
        this.startEdit(this.section() as EditableSection);
      }
    } catch (err) {
      this.loadError.set(errorMessage(err, 'User not found.'));
    }
  }

  protected go(key: SectionKey): void {
    this.moreOpen.set(false);
    if (this.editing() && this.editing() !== key) this.cancelEdit();
    this.section.set(key);
    void this.router.navigate([], { queryParams: { section: key }, replaceUrl: true });
  }

  private async loadAccess(): Promise<void> {
    const id = this.user()?.id;
    if (!id) return;
    this.accessLoading.set(true);
    try {
      this.access.set(await firstValueFrom(this.api.access(id)));
    } catch (err) {
      this.feedback.error(err, 'Could not load access.');
    } finally {
      this.accessLoading.set(false);
    }
  }

  private async loadSection(key: SectionKey): Promise<void> {
    const id = this.user()?.id;
    if (!id) return;
    try {
      switch (key) {
        case 'sessions':
          this.sessions.set(await firstValueFrom(this.api.sessions(id)));
          break;
        case 'notes':
          this.notes.set(await firstValueFrom(this.api.notes(id)));
          break;
        case 'requests':
          this.requests.set(await firstValueFrom(this.api.requests(id)));
          break;
        case 'status':
          this.statusHistory.set(await firstValueFrom(this.api.statusHistory(id)));
          break;
        case 'emails':
          this.emails.set(await firstValueFrom(this.api.emails(id)));
          break;
        case 'audit':
          this.audit.set(await firstValueFrom(this.api.audit(id)));
          break;
        default:
          break;
      }
    } catch (err) {
      this.feedback.error(err, 'Could not load this section.');
    }
  }

  private async refresh(): Promise<void> {
    const id = this.user()?.id;
    if (!id) return;
    this.user.set(await firstValueFrom(this.api.profile(id)));
    await Promise.all([this.loadAccess(), this.loadSection(this.section())]);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  protected can(action: UserAction): boolean {
    return this.user()?.actions.includes(action) ?? false;
  }

  protected meta(action: StateAction) {
    return ACTION_META[action];
  }

  protected async runAction(action: StateAction): Promise<void> {
    this.moreOpen.set(false);
    const u = this.user()!;
    this.busy.set(true);
    try {
      if (await this.actions.run(action, { id: u.id, fullName: u.personal.fullName }))
        await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  protected requestChange(): void {
    this.moreOpen.set(false);
    void this.router.navigate(['/iam/user-requests/create'], {
      queryParams: { type: 'ACCESS_CHANGE', userId: this.user()!.id },
    });
  }

  protected async assignGroups(): Promise<void> {
    const u = this.user()!;
    const current = this.access()?.groups.map((g) => g.groupId) ?? [];
    await this.dialogs.pick({
      title: 'Assign groups',
      description: `Roles attached to the groups are inherited by ${u.personal.fullName}.`,
      confirmText: 'Assign',
      searchPlaceholder: 'Search groups…',
      excludeIds: current,
      search: async (q) => this.searchLookup('groups', q),
      submit: async (ids) => {
        await firstValueFrom(this.api.setGroups(u.id, ids, 'merge'));
        this.feedback.success(`${ids.length} group(s) assigned.`);
        await this.refresh();
      },
    });
  }

  protected async removeGroup(groupId: string, name: string): Promise<void> {
    const u = this.user()!;
    const ok = await this.dialogs.confirm(
      `Remove ${name}?`,
      `${u.personal.fullName} loses every role inherited from this group.`,
      'Remove'
    );
    if (!ok) return;
    const remaining = (this.access()?.groups ?? [])
      .map((g) => g.groupId)
      .filter((id) => id !== groupId);
    await this.mutate(
      () => firstValueFrom(this.api.setGroups(u.id, remaining, 'replace')),
      'Group removed.'
    );
  }

  protected async assignRoles(): Promise<void> {
    const u = this.user()!;
    const direct = (this.access()?.roles ?? [])
      .filter((r) => r.sourceType === 'DIRECT')
      .map((r) => r.roleId);
    await this.dialogs.pick({
      title: 'Assign roles',
      description: 'Direct assignments bypass groups; prefer group membership where possible.',
      confirmText: 'Assign',
      searchPlaceholder: 'Search roles…',
      excludeIds: direct,
      search: async (q) => this.searchLookup('roles', q),
      submit: async (ids) => {
        await firstValueFrom(this.api.setRoles(u.id, ids, 'merge'));
        this.feedback.success(`${ids.length} role(s) assigned.`);
        await this.refresh();
      },
    });
  }

  protected async removeRole(roleId: string, name: string): Promise<void> {
    const u = this.user()!;
    const ok = await this.dialogs.confirm(
      `Remove ${name}?`,
      `The direct assignment is removed from ${u.personal.fullName}.`,
      'Remove'
    );
    if (!ok) return;
    const remaining = (this.access()?.roles ?? [])
      .filter((r) => r.sourceType === 'DIRECT' && r.roleId !== roleId)
      .map((r) => r.roleId);
    await this.mutate(
      () => firstValueFrom(this.api.setRoles(u.id, remaining, 'replace')),
      'Role removed.'
    );
  }

  protected async revokeOne(session: UserSession): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Revoke session?',
      `${session.device} · ${session.browser} is signed out immediately.`,
      'Revoke'
    );
    if (!ok) return;
    await this.mutate(async () => {
      this.sessions.set(await firstValueFrom(this.api.revokeSession(this.user()!.id, session.id)));
    }, 'Session revoked.');
  }

  protected async revokeAll(): Promise<void> {
    await this.runAction('revokeSessions');
  }

  protected async addNote(): Promise<void> {
    const body = this.noteBody().trim();
    if (!body) return;
    const attachmentUrl = this.noteAttachment.trim() || null;
    if (attachmentUrl && !/^https?:\/\/\S+$/i.test(attachmentUrl)) {
      this.feedback.error({ message: 'Attachment must be a valid URL.' });
      return;
    }
    await this.mutate(async () => {
      this.notes.set(
        await firstValueFrom(
          this.api.addNote(this.user()!.id, {
            body,
            noteType: this.noteType,
            visibility: this.noteVisibilityValue,
            attachmentUrl,
          })
        )
      );
      this.noteBody.set('');
      this.noteAttachment = '';
    }, 'Note added.');
  }

  private async mutate(action: () => Promise<unknown>, success: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.feedback.success(success);
      await this.refresh();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  private searchLookup(kind: 'groups' | 'roles', q: string) {
    const needle = q.trim().toLowerCase();
    const items = this.lookups()?.[kind] ?? [];
    return items
      .filter((i) => !needle || i.name.toLowerCase().includes(needle))
      .map((i) => ({ id: i.id, label: i.name, sublabel: i.key ?? null }));
  }

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  protected isEditable(key: string): key is EditableSection {
    return key === 'personal' || key === 'employee' || key === 'contact' || key === 'organization';
  }

  protected startEdit(section: EditableSection): void {
    const u = this.user();
    if (!u || !this.can('edit')) return;
    const { personal: p, employee: e, contact: c, organization: o } = u;
    const values: Record<EditableSection, Record<string, string | null>> = {
      personal: { ...p, avatarUrl: u.avatarUrl },
      employee: { ...e, joiningDate: e.joiningDate?.slice(0, 10) ?? null },
      contact: { ...c },
      organization: {
        branchId: o.branch?.id ?? null,
        departmentId: o.department?.id ?? null,
        teamId: o.team?.id ?? null,
        reportingManagerId: o.reportingManager?.id ?? null,
        assignedOfficerId: o.assignedOfficer?.id ?? null,
        accessScope: o.accessScope,
      },
    };
    this.draft.set(
      Object.fromEntries(
        this.EDIT_FIELDS[section].map((f) => [f.key, values[section][f.key] ?? ''])
      )
    );
    this.editErrors.set([]);
    this.editing.set(section);
    if (this.section() !== section) this.go(section);
  }

  protected patchDraft(key: string, value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value ?? '' }));
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.editErrors.set([]);
    void this.router.navigate([], { queryParams: { section: this.section() }, replaceUrl: true });
  }

  protected async saveEdit(): Promise<void> {
    const section = this.editing();
    if (!section) return;
    const d = this.draft();
    const errors = this.validate(section, d);
    this.editErrors.set(errors);
    if (errors.length) return;

    const lowercase = new Set(['username', 'workEmail']);
    const fields: Record<string, string | null> = {};
    for (const f of this.EDIT_FIELDS[section]) {
      const v = (d[f.key] ?? '').trim();
      fields[f.key] = lowercase.has(f.key) ? v.toLowerCase() : v || null;
    }
    const body: UpdateUserProfile = { [section]: fields };
    this.busy.set(true);
    try {
      this.user.set(await firstValueFrom(this.api.updateProfile(this.user()!.id, body)));
      this.feedback.success('Changes saved.');
      this.editing.set(null);
      void this.router.navigate([], { queryParams: { section }, replaceUrl: true });
      await this.loadAccess();
    } catch (err) {
      this.editErrors.set([errorMessage(err, 'Could not save changes.')]);
    } finally {
      this.busy.set(false);
    }
  }

  private validate(section: EditableSection, d: Record<string, string>): string[] {
    const e: string[] = [];
    const v = (k: string) => (d[k] ?? '').trim();
    for (const f of this.EDIT_FIELDS[section]) {
      if (f.required && !v(f.key)) e.push(`${f.label} is required`);
    }
    if (section === 'personal') {
      if (v('username') && !/^[a-z0-9_.-]{3,50}$/i.test(v('username'))) {
        e.push('Username: 3–50 letters, digits, dot, dash or underscore');
      }
      for (const k of ['firstName', 'lastName']) {
        if (v(k) && (v(k).length < 2 || v(k).length > 100))
          e.push(`${k === 'firstName' ? 'First' : 'Last'} Name must be 2–100 characters`);
      }
      if (
        v('avatarUrl') &&
        !/^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i.test(v('avatarUrl'))
      ) {
        e.push('Profile image must be a PNG, JPG, WEBP, GIF or SVG link');
      }
    }
    if (section === 'contact') {
      for (const [k, label] of [
        ['workEmail', 'Work Email'],
        ['alternateEmail', 'Alternate Email'],
      ]) {
        if (v(k) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v(k)))
          e.push(`${label} is not a valid email`);
      }
      for (const [k, label] of [
        ['mobile', 'Primary Contact Number'],
        ['alternateMobile', 'Alternate Contact Number'],
      ]) {
        if (v(k) && !/^[+0-9 ()-]{6,20}$/.test(v(k)))
          e.push(`${label} is not a valid phone number`);
      }
    }
    return e;
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  protected humanize(value: string): string {
    return value
      .toLowerCase()
      .split(/[_.]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  protected auditLabel(action: string): string {
    return this.humanize(action.replace(/^user\./, ''));
  }

  protected option(options: SelectControlOption[], value: string): string {
    return labelOf(options, value) ?? value;
  }
}
