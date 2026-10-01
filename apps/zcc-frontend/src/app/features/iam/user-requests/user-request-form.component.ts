import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DateControl, FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { IamApiService } from '../../../core/api/iam.api';
import { UserRequestsApiService } from '../../../core/api/user-requests.api';
import {
  AccessPreview,
  SaveUserRequest,
  UserRequestDetail,
  UserRequestLookups,
  UserRequestPriority,
  UserRequestType,
} from '../../../shared/models/user-request.model';
import { EmptyStateComponent } from '../../../shared/components/iam';
import { IAM_BTN, IAM_CARD, IAM_INPUT } from '../shared/iam-page-header.component';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { AccessPreviewComponent } from './components/access-preview.component';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { SelectedUser, UserSelectComponent } from './components/user-select.component';
import {
  ACCESS_SCOPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  FormPayload,
  PRIORITY_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  USER_TYPE_OPTIONS,
  emptyPayload,
  hasAccessChanges,
  labelOf,
  sectionsFor,
  toApiPayload,
  toFormPayload,
} from './user-request.constants';

type StepKey = 'request' | 'user' | 'employee' | 'organization' | 'access' | 'preview' | 'review';

const STEP_LABELS: Record<StepKey, string> = {
  request: 'Request',
  user: 'User Details',
  employee: 'Employee & Contact',
  organization: 'Organization',
  access: 'Groups & Roles',
  preview: 'Access Preview',
  review: 'Review',
};

const USERNAME = /^[a-z0-9_.-]{3,50}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+0-9 ()-]{6,20}$/;

const toMulti = (items: Array<{ id: string; name: string }>): MultiSelectOption[] =>
  items.map((i) => ({ value: i.id, label: i.name }));

/** Lookup list → select options, with a leading "empty" choice. */
const toSelect = (
  items: Array<{ id: string; name: string; code?: string | null }>,
  emptyLabel: string
): SelectControlOption[] => [
  { value: '', label: emptyLabel },
  ...items.map((i) => ({ value: i.id, label: i.name, description: i.code ?? undefined })),
];

@Component({
  selector: 'zcc-user-request-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    FormInputControl,
    SelectControl,
    DateControl,
    EmptyStateComponent,
    AccessPreviewComponent,
    MultiSelectComponent,
    UserSelectComponent,
  ],
  templateUrl: './user-request-form.component.html',
  styleUrl: './user-request-form.component.scss',
})
export class UserRequestFormComponent {
  private readonly api = inject(UserRequestsApiService);
  private readonly iam = inject(IamApiService);
  private readonly router = inject(Router);
  private readonly feedback = inject(IamFeedbackService);

  private readonly route = inject(ActivatedRoute).snapshot;
  /** Set on the edit route. */
  protected readonly requestId = signal(this.route.paramMap.get('requestId') ?? undefined);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly input = IAM_INPUT;
  protected readonly label = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400';
  protected readonly hint = 'mt-1 text-xs text-gray-400';
  protected readonly sectionTitle = 'mb-3 text-sm font-semibold text-gray-900 dark:text-white';
  protected readonly typeOptions: SelectControlOption[] = REQUEST_TYPE_OPTIONS;
  protected readonly priorityOptions: SelectControlOption[] = PRIORITY_OPTIONS;
  protected readonly scopeOptions: SelectControlOption[] = [
    { value: '', label: 'Role default' },
    ...ACCESS_SCOPE_OPTIONS,
  ];

  protected readonly type = signal<UserRequestType>('NEW_USER');
  protected readonly targetUserId = signal<string | null>(null);
  protected readonly targetLabel = signal<string | null>(null);
  protected readonly currentAccess = signal<{
    groups: Array<{ id: string; name: string }>;
    roles: Array<{ id: string; name: string }>;
  } | null>(null);
  protected priority: UserRequestPriority = 'NORMAL';
  protected justification = '';
  protected effectiveFrom = '';
  protected effectiveUntil = '';
  protected attachmentUrl = '';
  protected payload: FormPayload = emptyPayload();

  protected readonly lookups = signal<UserRequestLookups | null>(null);
  protected readonly names = signal<Record<string, string>>({});
  protected readonly refNo = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly current = signal<StepKey>('request');
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly preview = signal<AccessPreview | null>(null);
  protected readonly previewLoading = signal(false);

  protected readonly editing = computed(() => !!this.requestId());
  protected readonly isNew = computed(() => this.type() === 'NEW_USER');
  protected readonly sections = computed(() => sectionsFor(this.type()));
  protected readonly steps = computed<StepKey[]>(() => {
    const s = this.sections();
    const steps: StepKey[] = ['request'];
    if (s.user) steps.push('user');
    if (s.employee || s.contact) steps.push('employee');
    if (s.organization) steps.push('organization');
    if (hasAccessChanges(s)) steps.push('access');
    if (hasAccessChanges(s) || s.organization) steps.push('preview');
    steps.push('review');
    return steps;
  });
  protected readonly stepIndex = computed(() => this.steps().indexOf(this.current()));

  /** Blank choice: "Select…" for a new user, "Keep current" when updating. */
  private readonly blankLabel = computed(() => (this.isNew() ? 'Select…' : 'Keep current'));
  protected readonly userTypeOptions = computed<SelectControlOption[]>(() => [
    { value: '', label: this.blankLabel() },
    ...USER_TYPE_OPTIONS,
  ]);
  protected readonly employmentOptions = computed<SelectControlOption[]>(() => [
    { value: '', label: this.blankLabel() },
    ...EMPLOYMENT_TYPE_OPTIONS,
  ]);
  protected readonly branchOptions = computed(() =>
    toSelect(this.lookups()?.branches ?? [], this.blankLabel())
  );
  protected readonly departmentOptions = computed(() =>
    toSelect(this.lookups()?.departments ?? [], this.blankLabel())
  );
  protected readonly teamOptions = computed(() =>
    toSelect(this.lookups()?.teams ?? [], this.isNew() ? 'None' : 'Keep current')
  );

  protected readonly addGroupOptions = computed(() => {
    const assigned = new Set(this.currentAccess()?.groups.map((g) => g.id));
    return toMulti((this.lookups()?.groups ?? []).filter((g) => !assigned.has(g.id)));
  });
  protected readonly removeGroupOptions = computed(() =>
    toMulti(this.currentAccess()?.groups ?? [])
  );
  protected readonly addRoleOptions = computed(() => {
    const assigned = new Set(this.currentAccess()?.roles.map((r) => r.id));
    return toMulti((this.lookups()?.roles ?? []).filter((r) => !assigned.has(r.id)));
  });
  protected readonly removeRoleOptions = computed(() => toMulti(this.currentAccess()?.roles ?? []));

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      this.lookups.set(await firstValueFrom(this.api.lookups()));
    } catch (err) {
      this.feedback.error(err, 'Could not load branches, groups and roles.');
    }
    const id = this.requestId();
    if (!id) {
      await this.prefill();
      return;
    }
    try {
      this.patch(await firstValueFrom(this.api.get(id)));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Request not found.'));
    }
  }

  /** `?type=ACCESS_CHANGE&userId=…` from the Users pages preselects the type and user. */
  private async prefill(): Promise<void> {
    const type = this.route.queryParamMap.get('type');
    if (type && REQUEST_TYPE_OPTIONS.some((o) => o.value === type)) this.setType(type as UserRequestType);
    const userId = this.route.queryParamMap.get('userId');
    if (!userId || this.isNew()) return;
    try {
      const user = (await firstValueFrom(this.iam.getIamUser(userId))).data;
      this.onTarget({ id: user.id, name: user.fullName, email: user.email });
    } catch {
      this.feedback.error({ message: 'The selected user could not be loaded.' });
    }
  }

  private patch(d: UserRequestDetail): void {
    if (!d.actions.canEdit) {
      this.loadError.set(`${d.refNo} is ${d.statusLabel} and can no longer be edited.`);
      return;
    }
    this.refNo.set(d.refNo);
    this.type.set(d.type);
    this.priority = d.priority;
    this.justification = d.justification;
    this.effectiveFrom = d.effectiveFrom?.slice(0, 10) ?? '';
    this.effectiveUntil = d.effectiveUntil?.slice(0, 10) ?? '';
    this.attachmentUrl = d.attachmentUrl ?? '';
    this.payload = toFormPayload(d.payload);
    this.names.set(d.names);
    if (d.targetUser) {
      this.targetUserId.set(d.targetUser.id);
      this.targetLabel.set(`${d.targetUser.name} · ${d.targetUser.email}`);
      void this.loadCurrentAccess(d.targetUser.id);
    }
  }

  protected stepLabel(step: StepKey): string {
    return STEP_LABELS[step];
  }

  protected newUserName(): string {
    const u = this.payload.user;
    return u.displayName || [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ');
  }

  protected joinNames(items: Array<{ name: string }>): string {
    return items.length ? items.map((i) => i.name).join(', ') : 'None';
  }

  protected setType(type: UserRequestType): void {
    this.type.set(type);
    this.payload = emptyPayload();
    this.preview.set(null);
    this.errors.set([]);
    if (type === 'NEW_USER') {
      this.targetUserId.set(null);
      this.targetLabel.set(null);
      this.currentAccess.set(null);
    }
  }

  protected onTarget(user: SelectedUser | null): void {
    this.targetUserId.set(user?.id ?? null);
    this.targetLabel.set(user ? `${user.name} · ${user.email}` : null);
    this.payload.access = {
      addGroupIds: [],
      removeGroupIds: [],
      addRoleIds: [],
      removeRoleIds: [],
    };
    this.currentAccess.set(null);
    if (user) void this.loadCurrentAccess(user.id);
  }

  private async loadCurrentAccess(userId: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.iam.getIamUser(userId));
      this.currentAccess.set({
        groups: res.data.groups.map((g) => ({ id: g.groupId, name: g.groupName })),
        roles: res.data.roles.map((r) => ({ id: r.roleId, name: r.roleName })),
      });
    } catch {
      this.currentAccess.set({ groups: [], roles: [] });
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation & validation
  // ---------------------------------------------------------------------------

  protected goTo(step: StepKey): void {
    if (this.steps().indexOf(step) <= this.stepIndex()) {
      this.errors.set([]);
      this.current.set(step);
    }
  }

  protected back(): void {
    this.errors.set([]);
    this.current.set(this.steps()[Math.max(0, this.stepIndex() - 1)]);
  }

  protected async next(): Promise<void> {
    const errors = this.validate(this.current());
    this.errors.set(errors);
    if (errors.length) return;
    const nextStep = this.steps()[this.stepIndex() + 1];
    if (!nextStep) return;
    this.current.set(nextStep);
    if (nextStep === 'preview') await this.loadPreview();
  }

  private validate(step: StepKey): string[] {
    const e: string[] = [];
    const isNew = this.isNew();
    const type = this.type();
    const { user, employee, contact, organization, access } = this.payload;
    const blank = (v: string) => !v.trim();
    const nameLen = (v: string, field: string) => {
      const len = v.trim().length;
      if (len && (len < 2 || len > 100)) e.push(`${field} must be 2–100 characters`);
    };

    switch (step) {
      case 'request':
        if (!isNew && !this.targetUserId()) e.push('Select the user this request is for');
        if (this.justification.trim().length < 10)
          e.push('Business justification must be at least 10 characters');
        if (
          this.effectiveFrom &&
          this.effectiveUntil &&
          this.effectiveUntil <= this.effectiveFrom
        ) {
          e.push('Effective Until must be after Effective From');
        }
        if (this.attachmentUrl.trim() && !/^https?:\/\/\S+$/i.test(this.attachmentUrl.trim())) {
          e.push('Attachment must be a valid URL');
        }
        break;
      case 'user':
        if (isNew && blank(user.username)) e.push('Username is required');
        if (!blank(user.username) && !USERNAME.test(user.username.trim())) {
          e.push('Username: 3–50 lowercase letters, digits, dot, dash or underscore');
        }
        if (isNew && blank(user.firstName)) e.push('First Name is required');
        if (isNew && blank(user.lastName)) e.push('Last Name is required');
        if (isNew && !user.userType) e.push('User Type is required');
        nameLen(user.firstName, 'First Name');
        nameLen(user.lastName, 'Last Name');
        break;
      case 'employee':
        if (isNew && blank(employee.employeeCode)) e.push('Employee Code is required');
        if (isNew && !employee.employmentType) e.push('Employment Type is required');
        if (isNew && blank(contact.workEmail)) e.push('Work Email is required');
        for (const [v, f] of [
          [contact.workEmail, 'Work Email'],
          [contact.alternateEmail, 'Alternate Email'],
        ] as const) {
          if (!blank(v) && !EMAIL.test(v.trim())) e.push(`${f} is not a valid email`);
        }
        for (const [v, f] of [
          [contact.contactNumber, 'Contact Number'],
          [contact.alternateContactNumber, 'Alternate Contact Number'],
        ] as const) {
          if (!blank(v) && !PHONE.test(v.trim())) e.push(`${f} is not a valid phone number`);
        }
        if (type === 'UPDATE_USER' && this.untouchedUpdate()) {
          e.push('Change at least one user, employee or contact field');
        }
        break;
      case 'organization':
        if (isNew && !organization.branchId) e.push('Branch is required');
        if (isNew && !organization.departmentId) e.push('Department is required');
        if (
          type === 'TRANSFER' &&
          !organization.branchId &&
          !organization.departmentId &&
          !organization.teamId
        ) {
          e.push('Select the new branch, department or team');
        }
        break;
      case 'access': {
        const total =
          access.addGroupIds.length +
          access.removeGroupIds.length +
          access.addRoleIds.length +
          access.removeRoleIds.length;
        if (type === 'ADD_ROLE' && !access.addRoleIds.length)
          e.push('Select at least one role to add');
        if (type === 'REMOVE_ROLE' && !access.removeRoleIds.length)
          e.push('Select at least one role to remove');
        if (type === 'ADD_GROUP' && !access.addGroupIds.length)
          e.push('Select at least one group to add');
        if (type === 'REMOVE_GROUP' && !access.removeGroupIds.length)
          e.push('Select at least one group to remove');
        if (type === 'ACCESS_CHANGE' && !total) e.push('Add or remove at least one group or role');
        break;
      }
      default:
        break;
    }
    return e;
  }

  private untouchedUpdate(): boolean {
    const { user, employee, contact } = this.payload;
    return [user, employee, contact].every((section) =>
      Object.values(section).every((v) => !String(v).trim())
    );
  }

  private async loadPreview(): Promise<void> {
    this.previewLoading.set(true);
    try {
      this.preview.set(
        await firstValueFrom(
          this.api.preview({
            type: this.type(),
            targetUserId: this.targetUserId(),
            payload: toApiPayload(this.payload),
          })
        )
      );
    } catch (err) {
      this.preview.set(null);
      this.feedback.error(err, 'Could not calculate effective access.');
    } finally {
      this.previewLoading.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Review
  // ---------------------------------------------------------------------------

  protected reviewRows(): Array<{ label: string; value: string }> {
    const l = this.lookups();
    const nameIn = (list: Array<{ id: string; name: string }> | undefined, id: string) =>
      id ? (list?.find((x) => x.id === id)?.name ?? this.names()[id] ?? id) : '';
    const namesIn = (list: Array<{ id: string; name: string }> | undefined, ids: string[]) =>
      ids.map((id) => nameIn(list, id)).join(', ');
    const option = (options: Array<{ value: string; label: string }>, v: string) =>
      v ? labelOf(options, v) : '';
    const { user, employee, contact, organization, access } = this.payload;
    const rows: Array<{ label: string; value: string | null }> = [
      { label: 'Request Type', value: labelOf(REQUEST_TYPE_OPTIONS, this.type()) },
      { label: 'Requested For', value: this.isNew() ? this.newUserName() : this.targetLabel() },
      { label: 'Priority', value: labelOf(PRIORITY_OPTIONS, this.priority) },
      { label: 'Effective From', value: this.effectiveFrom },
      { label: 'Effective Until', value: this.effectiveUntil },
      { label: 'Business Justification', value: this.justification },
      { label: 'Username', value: user.username },
      {
        label: 'Name',
        value: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' '),
      },
      { label: 'Display Name', value: user.displayName },
      { label: 'User Type', value: option(USER_TYPE_OPTIONS, user.userType) },
      { label: 'Employee Code', value: employee.employeeCode },
      { label: 'Employment Type', value: option(EMPLOYMENT_TYPE_OPTIONS, employee.employmentType) },
      { label: 'Designation', value: employee.designation },
      { label: 'Joining Date', value: employee.joiningDate },
      { label: 'Work Email', value: contact.workEmail },
      { label: 'Contact Number', value: contact.contactNumber },
      { label: 'Branch', value: nameIn(l?.branches, organization.branchId) },
      { label: 'Department', value: nameIn(l?.departments, organization.departmentId) },
      { label: 'Team', value: nameIn(l?.teams, organization.teamId) },
      { label: 'Access Scope', value: option(ACCESS_SCOPE_OPTIONS, organization.accessScope) },
      { label: 'Requested Groups', value: namesIn(l?.groups, access.addGroupIds) },
      { label: 'Groups To Remove', value: namesIn(l?.groups, access.removeGroupIds) },
      { label: 'Requested Roles', value: namesIn(l?.roles, access.addRoleIds) },
      { label: 'Roles To Remove', value: namesIn(l?.roles, access.removeRoleIds) },
    ];
    return rows.filter((r): r is { label: string; value: string } => !!r.value);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private body(submit: boolean): SaveUserRequest {
    return {
      ...(this.editing() ? {} : { type: this.type(), submit }),
      targetUserId: this.isNew() ? null : this.targetUserId(),
      priority: this.priority,
      justification: this.justification.trim(),
      effectiveFrom: this.effectiveFrom || null,
      effectiveUntil: this.effectiveUntil || null,
      attachmentUrl: this.attachmentUrl.trim() || null,
      payload: toApiPayload(this.payload),
    };
  }

  protected async saveDraft(): Promise<void> {
    const errors = this.validate('request');
    this.errors.set(errors);
    if (errors.length) {
      this.current.set('request');
      return;
    }
    await this.persist(false);
  }

  protected async submit(): Promise<void> {
    const errors = this.steps().flatMap((s) => this.validate(s));
    this.errors.set(errors);
    if (errors.length) return;
    await this.persist(true);
  }

  private async persist(submit: boolean): Promise<void> {
    this.busy.set(true);
    try {
      const id = this.requestId();
      let saved = id
        ? await firstValueFrom(this.api.update(id, this.body(false)))
        : await firstValueFrom(this.api.create(this.body(submit)));
      if (id && submit) saved = await firstValueFrom(this.api.action(id, 'submit'));
      this.feedback.success(
        submit ? `${saved.refNo} submitted for approval.` : `${saved.refNo} saved as draft.`
      );
      await this.router.navigate(['/iam/user-requests', saved.id]);
    } catch (err) {
      const status = (err as { status?: number } | null)?.status ?? 0;
      if (status >= 400 && status < 500) this.errors.set([errorMessage(err)]);
      this.feedback.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
