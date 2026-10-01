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
import { UserRequestsApiService } from '../../../core/api/user-requests.api';
import {
  AccessPreview,
  UserRequestAuditEntry,
  UserRequestDetail,
  UserRequestEmail,
} from '../../../shared/models/user-request.model';
import {
  EmptyStateComponent,
  JsonDiffViewerComponent,
  StatusChipComponent,
} from '../../../shared/components/iam';
import { IAM_BTN, IAM_CARD, IAM_INPUT } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { formatDate, formatDateTime } from '../shared/iam-format';
import { AccessPreviewComponent } from './components/access-preview.component';
import {
  ACCESS_SCOPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  NOTE_TYPE_OPTIONS,
  NOTE_VISIBILITY_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_TONES,
  USER_TYPE_OPTIONS,
  labelOf,
} from './user-request.constants';

type SectionKey =
  | 'request'
  | 'user'
  | 'employee'
  | 'contact'
  | 'organization'
  | 'access'
  | 'approval'
  | 'notes'
  | 'history'
  | 'emails'
  | 'audit';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: 'request', label: 'Request Details', icon: 'pi pi-file' },
  { key: 'user', label: 'User Details', icon: 'pi pi-user' },
  { key: 'employee', label: 'Employee Details', icon: 'pi pi-id-card' },
  { key: 'contact', label: 'Contact Details', icon: 'pi pi-phone' },
  { key: 'organization', label: 'Organization', icon: 'pi pi-sitemap' },
  { key: 'access', label: 'Access', icon: 'pi pi-key' },
  { key: 'approval', label: 'Approval', icon: 'pi pi-check-square' },
  { key: 'notes', label: 'Notes', icon: 'pi pi-comment' },
  { key: 'history', label: 'Status History', icon: 'pi pi-history' },
  { key: 'emails', label: 'Email History', icon: 'pi pi-envelope' },
  { key: 'audit', label: 'Audit', icon: 'pi pi-shield' },
];

/** Sections that only make sense when the request carries that kind of data. */
const PROFILE_TYPES = new Set(['NEW_USER', 'UPDATE_USER']);
const ORG_TYPES = new Set(['NEW_USER', 'TRANSFER', 'UPDATE_USER']);

const APPROVAL_TONES: Record<string, string> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  SENT_BACK: 'rose',
  CANCELLED: 'gray',
  WAITING: 'gray',
};

const EMAIL_TONES: Record<string, string> = {
  QUEUED: 'gray',
  SENT: 'blue',
  DELIVERED: 'green',
  FAILED: 'red',
};

interface Field {
  label: string;
  value: string | null | undefined;
}

@Component({
  selector: 'zcc-user-request-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormInputControl,
    SelectControl,
    StatusChipComponent,
    EmptyStateComponent,
    JsonDiffViewerComponent,
    AccessPreviewComponent,
  ],
  templateUrl: './user-request-detail.component.html',
  styleUrl: './user-request-detail.component.scss',
})
export class UserRequestDetailComponent {
  private readonly api = inject(UserRequestsApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  private readonly route = inject(ActivatedRoute);
  private readonly requestId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('requestId') ?? '')),
    { initialValue: '' }
  );
  /** `?section=` deep link, e.g. from the list's More menu. */
  private readonly sectionParam = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('section')))
  );

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly dateTime = formatDateTime;
  protected readonly noteTypeOptions: SelectControlOption[] = NOTE_TYPE_OPTIONS;
  protected readonly noteVisibilityOptions: SelectControlOption[] = NOTE_VISIBILITY_OPTIONS;
  protected readonly approvalHeaders = [
    'Level',
    'Step',
    'Approver',
    'Decision',
    'Assigned On',
    'Actioned On',
    'Comments',
  ];
  protected readonly emailHeaders = [
    'Email ID',
    'Template',
    'Recipient',
    'Subject',
    'Trigger',
    'Sent Date',
    'Delivery Status',
    'Attempts',
    '',
  ];

  protected readonly request = signal<UserRequestDetail | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly section = signal<SectionKey>('request');
  protected readonly busy = signal(false);
  protected readonly access = signal<AccessPreview | null>(null);
  protected readonly accessLoading = signal(false);
  protected readonly audit = signal<UserRequestAuditEntry[]>([]);
  protected readonly auditLoading = signal(false);
  protected readonly openAudit = signal<string | null>(null);
  protected readonly noteBody = signal('');
  protected noteType = 'GENERAL';
  protected noteVisibility = 'INTERNAL';
  protected noteAttachment = '';

  protected readonly sections = computed(() => {
    const type = this.request()?.type ?? '';
    return SECTIONS.filter((s) => {
      if (s.key === 'user' || s.key === 'employee' || s.key === 'contact')
        return PROFILE_TYPES.has(type);
      if (s.key === 'organization') return ORG_TYPES.has(type);
      return true;
    });
  });
  protected readonly sectionLabel = computed(
    () => SECTIONS.find((s) => s.key === this.section())?.label ?? ''
  );
  protected readonly statusTone = computed(() => STATUS_TONES[this.request()?.status ?? 'DRAFT']);
  protected readonly failedEmails = computed(
    () => this.request()?.emails.filter((m) => m.deliveryStatus === 'FAILED').length ?? 0
  );

  protected readonly summary = computed<Field[]>(() => {
    const r = this.request();
    if (!r) return [];
    return [
      { label: 'Request Ref No', value: r.refNo },
      { label: 'Request Type', value: r.typeLabel },
      { label: 'User', value: r.subjectName ?? r.targetUser?.name },
      { label: 'Employee Code', value: r.employeeCode },
      { label: 'Requested By', value: r.requestedBy?.name },
      { label: 'Requested Date', value: formatDate(r.createdAt) },
      { label: 'Priority', value: labelOf(PRIORITY_OPTIONS, r.priority) },
      { label: 'Status', value: r.statusLabel },
    ];
  });

  protected readonly fields = computed<Field[]>(() => {
    const r = this.request();
    if (!r) return [];
    const { user, employee, contact, organization } = r.payload;
    const name = (id: string | null) => (id ? (r.names[id] ?? id) : null);
    switch (this.section()) {
      case 'request':
        return [
          { label: 'Request Ref No', value: r.refNo },
          { label: 'Request Type', value: r.typeLabel },
          { label: 'Request Status', value: r.statusLabel },
          {
            label: 'Requested For',
            value: r.targetUser ? `${r.targetUser.name} · ${r.targetUser.email}` : r.subjectName,
          },
          { label: 'Requested By', value: r.requestedBy?.name },
          { label: 'Requested Date/Time', value: formatDateTime(r.createdAt) },
          { label: 'Submitted', value: r.submittedAt && formatDateTime(r.submittedAt) },
          { label: 'Completed', value: r.completedAt && formatDateTime(r.completedAt) },
          { label: 'Priority', value: labelOf(PRIORITY_OPTIONS, r.priority) },
          { label: 'Effective From', value: r.effectiveFrom && formatDate(r.effectiveFrom) },
          { label: 'Effective Until', value: r.effectiveUntil && formatDate(r.effectiveUntil) },
          { label: 'Source', value: this.humanize(r.source) },
          { label: 'Business Justification', value: r.justification },
          { label: 'Attachment', value: r.attachmentUrl },
        ];
      case 'user':
        return [
          { label: 'Username', value: user.username },
          { label: 'First Name', value: user.firstName },
          { label: 'Middle Name', value: user.middleName },
          { label: 'Last Name', value: user.lastName },
          {
            label: 'Display Name',
            value:
              user.displayName ??
              [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' '),
          },
          { label: 'User Type', value: user.userType && labelOf(USER_TYPE_OPTIONS, user.userType) },
          {
            label: 'Account Status',
            value: r.targetUser
              ? this.humanize(r.targetUser.status)
              : 'Pending (created on provisioning)',
          },
        ];
      case 'employee':
        return [
          { label: 'Employee Code', value: employee.employeeCode },
          {
            label: 'Employment Type',
            value:
              employee.employmentType && labelOf(EMPLOYMENT_TYPE_OPTIONS, employee.employmentType),
          },
          { label: 'Designation', value: employee.designation },
          { label: 'Department', value: name(organization.departmentId) },
          {
            label: 'Joining Date',
            value: employee.joiningDate && formatDate(employee.joiningDate),
          },
          { label: 'Reporting Manager', value: name(organization.reportingManagerId) },
          { label: 'Company / Organization', value: employee.company },
          { label: 'Work Location', value: employee.workLocation },
        ];
      case 'contact':
        return [
          { label: 'Work Email', value: contact.workEmail },
          { label: 'Contact Number', value: contact.contactNumber },
          { label: 'Alternate Email', value: contact.alternateEmail },
          { label: 'Alternate Contact Number', value: contact.alternateContactNumber },
          { label: 'Address Line 1', value: contact.addressLine1 },
          { label: 'Address Line 2', value: contact.addressLine2 },
          { label: 'City', value: contact.city },
          { label: 'State', value: contact.state },
          { label: 'Country', value: contact.country },
          { label: 'Postal Code', value: contact.postalCode },
        ];
      case 'organization':
        return [
          { label: 'Branch', value: name(organization.branchId) },
          { label: 'Department', value: name(organization.departmentId) },
          { label: 'Team', value: name(organization.teamId) },
          { label: 'Reporting Manager', value: name(organization.reportingManagerId) },
          { label: 'Assigned Officer', value: name(organization.assignedOfficerId) },
          { label: 'Cost Center', value: organization.costCenter },
          { label: 'Location', value: organization.location },
          {
            label: 'Access Scope',
            value:
              organization.accessScope && labelOf(ACCESS_SCOPE_OPTIONS, organization.accessScope),
          },
        ];
      default:
        return [];
    }
  });

  protected readonly accessLists = computed<Field[]>(() => {
    const r = this.request();
    if (!r) return [];
    const names = (ids: string[]) => ids.map((id) => r.names[id] ?? id).join(', ');
    const current = this.access()?.comparison;
    return [
      {
        label: 'Assigned Groups',
        value: r.type === 'NEW_USER' ? '' : current?.find((c) => c.key === 'groups')?.current,
      },
      {
        label: 'Assigned Roles',
        value: r.type === 'NEW_USER' ? '' : current?.find((c) => c.key === 'roles')?.current,
      },
      { label: 'Requested Groups', value: names(r.payload.access.addGroupIds) },
      { label: 'Requested Roles', value: names(r.payload.access.addRoleIds) },
      { label: 'Groups To Remove', value: names(r.payload.access.removeGroupIds) },
      { label: 'Roles To Remove', value: names(r.payload.access.removeRoleIds) },
    ];
  });

  protected readonly workflow = computed(() => {
    const r = this.request();
    if (!r) return [];
    const stepNames = [...new Set(r.approvals.map((a) => a.stepName))];
    const approved = new Set(
      r.approvals.filter((a) => a.status === 'APPROVED').map((a) => a.stepName)
    );
    const completed = r.status === 'COMPLETED';
    return [
      { label: 'Request Submitted', done: !!r.submittedAt, active: false },
      ...stepNames.map((name) => ({
        label: name,
        done: approved.has(name) && r.currentStep?.stepName !== name,
        active: r.currentStep?.stepName === name,
      })),
      { label: 'Provisioning', done: completed, active: r.status === 'PROVISIONING' },
      { label: 'Completed', done: completed, active: false },
    ];
  });

  constructor() {
    effect(() => {
      const id = this.requestId();
      if (id) void this.load(id);
    });
    effect(() => {
      const s = this.sectionParam();
      if (s && SECTIONS.some((x) => x.key === s)) this.section.set(s as SectionKey);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.request.set(await firstValueFrom(this.api.get(id)));
      this.loadError.set(null);
      await this.loadSectionData(this.section());
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Request not found.'));
    }
  }

  protected go(key: SectionKey): void {
    this.section.set(key);
    void this.router.navigate([], {
      queryParams: { section: key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.loadSectionData(key);
  }

  private async loadSectionData(key: SectionKey): Promise<void> {
    const id = this.request()?.id;
    if (!id) return;
    if (key === 'access') {
      this.accessLoading.set(true);
      try {
        this.access.set(await firstValueFrom(this.api.access(id)));
      } catch (err) {
        this.feedback.error(err, 'Could not load access preview.');
      } finally {
        this.accessLoading.set(false);
      }
    }
    if (key === 'audit') {
      this.auditLoading.set(true);
      try {
        this.audit.set(await firstValueFrom(this.api.audit(id)));
      } catch (err) {
        this.feedback.error(err, 'Could not load audit trail.');
      } finally {
        this.auditLoading.set(false);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Workflow actions
  // ---------------------------------------------------------------------------

  protected async act(action: 'submit' | 'retry-provisioning'): Promise<void> {
    const id = this.request()!.id;
    await this.run(
      () => firstValueFrom(this.api.action(id, action)),
      action === 'submit' ? 'Request submitted for approval.' : 'Provisioning retried.'
    );
  }

  protected async approve(): Promise<void> {
    const r = this.request()!;
    await this.decisionDialog({
      title: `Approve ${r.refNo}?`,
      description: r.currentStep
        ? `${r.currentStep.stepName} (level ${r.currentStep.level}).`
        : undefined,
      submitText: 'Approve',
      commentLabel: 'Comments',
      required: false,
      action: 'approve',
      message: 'Approved.',
    });
  }

  protected async decide(action: 'reject' | 'send-back'): Promise<void> {
    const r = this.request()!;
    const reject = action === 'reject';
    await this.decisionDialog({
      title: reject ? `Reject ${r.refNo}?` : `Send ${r.refNo} back?`,
      description: reject
        ? 'The request will be closed. The requester is notified with your comment.'
        : 'The requester can edit and resubmit the request.',
      submitText: reject ? 'Reject' : 'Send Back',
      commentLabel: 'Comments',
      required: true,
      danger: reject,
      action,
      message: reject ? 'Request rejected.' : 'Request sent back to the requester.',
    });
  }

  protected async cancel(): Promise<void> {
    const r = this.request()!;
    await this.decisionDialog({
      title: `Cancel ${r.refNo}?`,
      description: 'Cancelled requests cannot be reopened.',
      submitText: 'Cancel Request',
      commentLabel: 'Reason',
      required: false,
      danger: true,
      action: 'cancel',
      message: 'Request cancelled.',
    });
  }

  /** Comment dialog that runs the workflow action itself, so API errors stay inline. */
  private async decisionDialog(opts: {
    title: string;
    description?: string;
    submitText: string;
    commentLabel: string;
    required: boolean;
    danger?: boolean;
    action: 'approve' | 'reject' | 'send-back' | 'cancel';
    message: string;
  }): Promise<void> {
    const id = this.request()!.id;
    let updated: UserRequestDetail | null = null;
    const values = await this.dialogs.form({
      title: opts.title,
      description: opts.description,
      submitText: opts.submitText,
      variant: opts.danger ? 'danger' : 'primary',
      fields: [
        {
          key: 'comments',
          label: opts.commentLabel,
          type: 'textarea',
          required: opts.required,
          maxLength: 2000,
        },
      ],
      submit: async (v) => {
        const comments = String(v['comments'] ?? '').trim() || null;
        updated = await firstValueFrom(this.api.action(id, opts.action, comments));
      },
    });
    if (!values || !updated) return;
    this.request.set(updated);
    this.feedback.success(opts.message);
    await this.loadSectionData(this.section());
  }

  protected async addNote(): Promise<void> {
    const body = this.noteBody().trim();
    if (!body) return;
    const attachmentUrl = this.noteAttachment.trim() || null;
    if (attachmentUrl && !/^https?:\/\/\S+$/i.test(attachmentUrl)) {
      this.feedback.error({ message: 'Attachment must be a valid URL.' });
      return;
    }
    const ok = await this.run(
      () =>
        firstValueFrom(
          this.api.addNote(this.request()!.id, {
            body,
            noteType: this.noteType,
            visibility: this.noteVisibility,
            attachmentUrl,
          })
        ),
      'Note added.'
    );
    if (ok) {
      this.noteBody.set('');
      this.noteAttachment = '';
    }
  }

  protected async retryEmail(m: UserRequestEmail): Promise<void> {
    await this.run(
      () => firstValueFrom(this.api.retryEmail(this.request()!.id, m.id)),
      `Retried email to ${m.recipient}.`
    );
  }

  protected async viewEmail(m: UserRequestEmail): Promise<void> {
    await this.dialogs.confirm(m.subject, `To: ${m.recipient}\n\n${m.bodyText}`, 'Close', false);
  }

  private async run(action: () => Promise<UserRequestDetail>, message: string): Promise<boolean> {
    this.busy.set(true);
    try {
      this.request.set(await action());
      this.feedback.success(message);
      await this.loadSectionData(this.section());
      return true;
    } catch (err) {
      this.feedback.error(err);
      return false;
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
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  protected approvalTone(status: string): string {
    return APPROVAL_TONES[status] ?? 'gray';
  }

  protected emailTone(status: string): string {
    return EMAIL_TONES[status] ?? 'gray';
  }

  protected optionLabel(options: Array<{ value: string; label: string }>, value: string): string {
    return labelOf(options, value);
  }
}
