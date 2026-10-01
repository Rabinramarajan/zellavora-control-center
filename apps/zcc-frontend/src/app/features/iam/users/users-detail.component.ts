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
  templateUrl: './users-detail.component.html',
  styleUrl: './users-detail.component.scss',
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
