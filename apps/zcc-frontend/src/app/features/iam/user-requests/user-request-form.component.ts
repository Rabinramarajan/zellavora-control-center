import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DateControl, FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { IamApiService } from '@core/api/iam.api';
import { UserRequestsApiService } from '@core/api/user-requests.api';
import {
  AccessPreview,
  SaveUserRequest,
  UserRequestDetail,
  UserRequestLookups,
  UserRequestPriority,
  UserRequestType,
} from '@shared/models/user-request.model';
import { EmptyStateComponent } from '@shared/components/iam';
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
  template: `
    <a
      [routerLink]="editing() ? ['/iam/user-requests', requestId()] : '/iam/user-requests'"
      class="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
    >
      <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
      {{ editing() ? 'Back to request' : 'User Requests' }}
    </a>
    <h1 class="mb-1 text-xl font-bold text-gray-900 dark:text-white">
      {{ editing() ? 'Edit ' + (refNo() ?? 'Request') : 'New User Request' }}
    </h1>
    <p class="mb-5 text-sm text-gray-500 dark:text-gray-400">
      The form adapts to the request type. Changes are applied only after approval and provisioning.
    </p>

    @if (loadError()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Unable to open request"
        [message]="loadError()!"
      />
    } @else {
      <nav aria-label="Request steps" class="mb-5 overflow-x-auto">
        <ol class="flex min-w-max gap-1">
          @for (step of steps(); track step; let i = $index) {
            <li>
              <button
                type="button"
                class="flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
                [class]="
                  step === current()
                    ? 'bg-indigo-500 text-white'
                    : i < stepIndex()
                      ? 'text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300'
                      : 'text-gray-400'
                "
                [attr.aria-current]="step === current() ? 'step' : null"
                [disabled]="i > stepIndex()"
                (click)="goTo(step)"
              >
                <span
                  class="flex size-5 items-center justify-center rounded-full text-[11px]"
                  [class]="step === current() ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'"
                  >{{ i + 1 }}</span
                >
                {{ stepLabel(step) }}
              </button>
            </li>
          }
        </ol>
      </nav>

      <form [class]="card" (ngSubmit)="next()" novalidate>
        @if (errors().length) {
          <div
            role="alert"
            class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
          >
            <ul class="list-inside list-disc space-y-0.5">
              @for (e of errors(); track e) {
                <li>{{ e }}</li>
              }
            </ul>
          </div>
        }

        @switch (current()) {
          @case ('request') {
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <app-select-control
                label="Request Type"
                icon="list"
                [required]="true"
                [disabled]="editing()"
                [options]="typeOptions"
                [value]="type()"
                (valueChange)="setType($any($event))"
              />
              <div>
                <label for="f-for" [class]="label"
                  >Requested For <span class="text-red-500">*</span></label
                >
                @if (type() === 'NEW_USER') {
                  <p [class]="input + ' min-h-[40px] text-gray-500'">
                    {{ newUserName() || 'New user — enter details in the next step' }}
                  </p>
                } @else {
                  <zcc-user-select
                    inputId="f-for"
                    placeholder="Search existing user…"
                    [initialLabel]="targetLabel()"
                    [value]="targetUserId()"
                    (selected)="onTarget($event)"
                  />
                }
              </div>
              <app-select-control
                label="Priority"
                [required]="true"
                [searchable]="false"
                [options]="priorityOptions"
                [value]="priority"
                (valueChange)="priority = $any($event)"
              />
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <app-date-control label="Effective From" [(value)]="effectiveFrom" />
                <app-date-control
                  label="Effective Until"
                  [minDate]="effectiveFrom || undefined"
                  [(value)]="effectiveUntil"
                />
              </div>
              <div class="md:col-span-2">
                <label for="f-just" [class]="label"
                  >Reason / Business Justification <span class="text-red-500">*</span></label
                >
                <textarea
                  id="f-just"
                  name="justification"
                  rows="3"
                  maxlength="2000"
                  [class]="input"
                  placeholder="Why is this change needed? (min 10 characters)"
                  [(ngModel)]="justification"
                ></textarea>
              </div>
              <div class="md:col-span-2">
                <app-form-input-control
                  label="Attachment URL"
                  hint="Link to an approval memo, ticket or supporting document."
                  placeholder="https://…"
                  [maxLength]="1000"
                  [(value)]="attachmentUrl"
                />
              </div>
            </div>
          }

          @case ('user') {
            @if (type() === 'UPDATE_USER') {
              <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Leave a field blank to keep its current value.
              </p>
            }
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <app-form-input-control
                label="Username"
                icon="user"
                hint="Unique. 3–50 lowercase letters, digits, dot, dash or underscore."
                [required]="isNew()"
                [maxLength]="50"
                [(value)]="payload.user.username"
              />
              <app-select-control
                label="User Type"
                [required]="isNew()"
                [searchable]="false"
                [options]="userTypeOptions()"
                [(value)]="payload.user.userType"
              />
              <app-form-input-control
                label="First Name"
                [required]="isNew()"
                [maxLength]="100"
                [(value)]="payload.user.firstName"
              />
              <app-form-input-control
                label="Middle Name"
                [maxLength]="100"
                [(value)]="payload.user.middleName"
              />
              <app-form-input-control
                label="Last Name"
                [required]="isNew()"
                [maxLength]="100"
                [(value)]="payload.user.lastName"
              />
              <app-form-input-control
                label="Display Name"
                hint="Derived from the name when left blank."
                [placeholder]="newUserName()"
                [maxLength]="200"
                [(value)]="payload.user.displayName"
              />
            </div>
          }

          @case ('employee') {
            <h2 [class]="sectionTitle">Employee Details</h2>
            <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <app-form-input-control
                label="Employee Code"
                hint="Must be unique."
                [required]="isNew()"
                [maxLength]="50"
                [(value)]="payload.employee.employeeCode"
              />
              <app-select-control
                label="Employment Type"
                [required]="isNew()"
                [searchable]="false"
                [options]="employmentOptions()"
                [(value)]="payload.employee.employmentType"
              />
              <app-form-input-control
                label="Designation"
                [maxLength]="150"
                [(value)]="payload.employee.designation"
              />
              <app-date-control label="Joining Date" [(value)]="payload.employee.joiningDate" />
              <app-form-input-control
                label="Company / Organization"
                [maxLength]="200"
                [(value)]="payload.employee.company"
              />
              <app-form-input-control
                label="Work Location"
                [maxLength]="200"
                [(value)]="payload.employee.workLocation"
              />
            </div>

            <h2 [class]="sectionTitle">Contact Details</h2>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <app-form-input-control
                label="Work Email"
                type="email"
                icon="email"
                hint="Used as the account identity."
                [required]="isNew()"
                [maxLength]="254"
                [(value)]="payload.contact.workEmail"
              />
              <app-form-input-control
                label="Contact Number"
                type="tel"
                icon="phone"
                [(value)]="payload.contact.contactNumber"
              />
              <app-form-input-control
                label="Alternate Email"
                type="email"
                icon="email"
                [(value)]="payload.contact.alternateEmail"
              />
              <app-form-input-control
                label="Alternate Contact Number"
                type="tel"
                icon="phone"
                [(value)]="payload.contact.alternateContactNumber"
              />
              <app-form-input-control
                label="Address Line 1"
                [maxLength]="200"
                [(value)]="payload.contact.addressLine1"
              />
              <app-form-input-control
                label="Address Line 2"
                [maxLength]="200"
                [(value)]="payload.contact.addressLine2"
              />
              <app-form-input-control
                label="City"
                [maxLength]="100"
                [(value)]="payload.contact.city"
              />
              <app-form-input-control
                label="State"
                [maxLength]="100"
                [(value)]="payload.contact.state"
              />
              <app-form-input-control
                label="Country"
                [maxLength]="100"
                [(value)]="payload.contact.country"
              />
              <app-form-input-control
                label="Postal Code"
                [maxLength]="20"
                [(value)]="payload.contact.postalCode"
              />
            </div>
          }

          @case ('organization') {
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <app-select-control
                label="Branch"
                icon="building"
                searchPlaceholder="Search branch…"
                [required]="isNew()"
                [options]="branchOptions()"
                [(value)]="payload.organization.branchId"
              />
              <app-select-control
                label="Department"
                icon="building"
                searchPlaceholder="Search department…"
                [required]="isNew()"
                [options]="departmentOptions()"
                [(value)]="payload.organization.departmentId"
              />
              <app-select-control
                label="Team"
                icon="user"
                searchPlaceholder="Search team…"
                [options]="teamOptions()"
                [(value)]="payload.organization.teamId"
              />
              <div>
                <label for="f-mgr" [class]="label">Reporting Manager</label>
                <zcc-user-select
                  inputId="f-mgr"
                  [initialLabel]="names()[payload.organization.reportingManagerId] || null"
                  [value]="payload.organization.reportingManagerId || null"
                  (valueChange)="payload.organization.reportingManagerId = $event ?? ''"
                />
                <p [class]="hint">Adds a Manager Approval step.</p>
              </div>
              <div>
                <label for="f-officer" [class]="label">Assigned Officer</label>
                <zcc-user-select
                  inputId="f-officer"
                  [initialLabel]="names()[payload.organization.assignedOfficerId] || null"
                  [value]="payload.organization.assignedOfficerId || null"
                  (valueChange)="payload.organization.assignedOfficerId = $event ?? ''"
                />
              </div>
              <app-form-input-control
                label="Cost Center"
                [maxLength]="50"
                [(value)]="payload.organization.costCenter"
              />
              <app-form-input-control
                label="Location"
                [maxLength]="200"
                [(value)]="payload.organization.location"
              />
              <app-select-control
                label="Access Scope"
                icon="globe"
                hint="Limits which records the granted permissions apply to."
                [searchable]="false"
                [options]="scopeOptions"
                [(value)]="payload.organization.accessScope"
              />
            </div>
          }

          @case ('access') {
            @if (currentAccess(); as ca) {
              <div class="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
                  <p class="text-xs font-medium text-gray-500">Assigned Groups</p>
                  <p class="text-sm text-gray-800 dark:text-gray-200">{{ joinNames(ca.groups) }}</p>
                </div>
                <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
                  <p class="text-xs font-medium text-gray-500">Assigned Roles</p>
                  <p class="text-sm text-gray-800 dark:text-gray-200">{{ joinNames(ca.roles) }}</p>
                </div>
              </div>
            }
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              @if (sections().addGroups) {
                <div>
                  <label for="f-addg" [class]="label">Requested Groups</label>
                  <zcc-multi-select
                    inputId="f-addg"
                    placeholder="Select groups to add"
                    [options]="addGroupOptions()"
                    [(value)]="payload.access.addGroupIds"
                  />
                </div>
              }
              @if (sections().removeGroups) {
                <div>
                  <label for="f-remg" [class]="label">Groups To Remove</label>
                  <zcc-multi-select
                    inputId="f-remg"
                    placeholder="Select groups to remove"
                    [options]="removeGroupOptions()"
                    [(value)]="payload.access.removeGroupIds"
                  />
                </div>
              }
              @if (sections().addRoles) {
                <div>
                  <label for="f-addr" [class]="label">Requested Roles</label>
                  <zcc-multi-select
                    inputId="f-addr"
                    placeholder="Select roles to add"
                    [options]="addRoleOptions()"
                    [(value)]="payload.access.addRoleIds"
                  />
                </div>
              }
              @if (sections().removeRoles) {
                <div>
                  <label for="f-remr" [class]="label">Roles To Remove</label>
                  <zcc-multi-select
                    inputId="f-remr"
                    placeholder="Select roles to remove"
                    [options]="removeRoleOptions()"
                    [(value)]="payload.access.removeRoleIds"
                  />
                </div>
              }
            </div>
            <p [class]="hint + ' mt-4'">
              Permissions are calculated from roles (directly or through groups). Review them on the
              next step.
            </p>
          }

          @case ('preview') {
            @if (previewLoading()) {
              <div class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
            } @else if (preview()) {
              <zcc-access-preview [preview]="preview()" [showCurrent]="!isNew()" />
            } @else {
              <p class="text-sm text-gray-500">Access preview is unavailable.</p>
            }
          }

          @case ('review') {
            <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
              @for (row of reviewRows(); track row.label) {
                <div class="border-b border-gray-100 pb-2 dark:border-white/5">
                  <dt class="text-xs font-medium text-gray-500">{{ row.label }}</dt>
                  <dd class="mt-0.5 whitespace-pre-line text-gray-900 dark:text-white">
                    {{ row.value }}
                  </dd>
                </div>
              }
            </dl>
            @if (preview()?.privileged) {
              <p class="mt-4 text-sm text-amber-600 dark:text-amber-300">
                <i class="pi pi-shield mr-1" aria-hidden="true"></i>
                Privileged access: Security Approval will be required.
              </p>
            }
          }
        }

        <div
          class="mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5"
        >
          <button type="button" [class]="btn.secondary" [disabled]="busy()" (click)="saveDraft()">
            <i class="pi pi-save text-xs" aria-hidden="true"></i>
            Save as Draft
          </button>
          <div class="flex gap-2">
            @if (stepIndex() > 0) {
              <button type="button" [class]="btn.secondary" [disabled]="busy()" (click)="back()">
                Back
              </button>
            }
            @if (current() === 'review') {
              <button type="button" [class]="btn.primary" [disabled]="busy()" (click)="submit()">
                <i class="pi pi-send text-xs" aria-hidden="true"></i>
                Submit Request
              </button>
            } @else {
              <button type="submit" [class]="btn.primary" [disabled]="busy()">
                Next
                <i class="pi pi-arrow-right text-xs" aria-hidden="true"></i>
              </button>
            }
          </div>
        </div>
      </form>
    }
  `,
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
