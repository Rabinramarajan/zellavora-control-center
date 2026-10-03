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
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { UserAdminApiService } from '../../../core/api/user-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import {
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
import {
  ACTION_META,
  REQUEST_CHANGE_META,
  RequestChangeType,
  StateAction,
  UserActionsService,
} from '../../users/user-actions';

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

@Component({
  selector: 'zcc-users-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormInputControl,
    SelectControl,
    StatusChipComponent,
    EmptyStateComponent,
    JsonDiffViewerComponent,
  ],
  host: { '(document:click)': 'moreOpen.set(false); changeOpen.set(false)' },
  templateUrl: './users-detail.component.html',
  styleUrl: './users-detail.component.scss',
})
export class UsersDetailComponent {
  private readonly api = inject(UserAdminApiService);
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

  /**
   * Direct actions the server allows: emergency responses and messages only. Every other
   * change is raised as a User Request from the Request Change menu.
   */
  protected readonly stateActions = computed(() => this.user()?.actions ?? []);
  protected readonly securityActions = computed(() =>
    this.stateActions().filter(
      (a) => a === 'sendPasswordReset' || a === 'lock' || a === 'revokeSessions'
    )
  );
  /** User Request types the server says can be raised for this account right now. */
  protected readonly changes = computed(() => this.user()?.requestableChanges ?? []);
  protected readonly changeOpen = signal(false);

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
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.api.profile(id)));
      this.loadError.set(null);
      await Promise.all([this.loadAccess(), this.loadSection(this.section())]);
    } catch (err) {
      this.loadError.set(errorMessage(err, 'User not found.'));
    }
  }

  protected go(key: SectionKey): void {
    this.moreOpen.set(false);
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

  /** Opens a User Request for this user, prefilled with the chosen change type. */
  protected requestChange(type: RequestChangeType): void {
    this.changeOpen.set(false);
    this.moreOpen.set(false);
    void this.router.navigate(['/iam/user-requests/create'], {
      queryParams: { type, userId: this.user()!.id },
    });
  }

  protected canRequest(type: RequestChangeType): boolean {
    return this.changes().includes(type);
  }

  protected changeMeta(type: RequestChangeType) {
    return REQUEST_CHANGE_META[type];
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
