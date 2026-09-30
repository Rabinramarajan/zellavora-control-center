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
import { UserRequestsApiService } from '@core/api/user-requests.api';
import {
  AccessPreview,
  UserRequestAuditEntry,
  UserRequestDetail,
  UserRequestEmail,
} from '@shared/models/user-request.model';
import {
  EmptyStateComponent,
  JsonDiffViewerComponent,
  StatusChipComponent,
} from '@shared/components/iam';
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
  template: `
    @if (loadError()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Unable to load request"
        [message]="loadError()!"
      />
    } @else if (!request()) {
      <div class="space-y-3">
        <div class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        <div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
      </div>
    } @else {
      @let r = request()!;
      <div class="sticky top-0 z-10 -mx-1 mb-5 bg-inherit px-1 pb-1">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <a
              routerLink="/iam/user-requests"
              [class]="btn.icon"
              aria-label="Back to user requests"
              title="Back"
            >
              <i class="pi pi-arrow-left" aria-hidden="true"></i>
            </a>
            <h1 class="truncate text-xl font-bold text-gray-900 dark:text-white">
              User Request Detail
            </h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <zcc-status-chip [value]="r.status" [label]="r.statusLabel" [tone]="statusTone()" />
            @if (r.actions.canEdit) {
              <a [routerLink]="['/iam/user-requests', r.id, 'edit']" [class]="btn.secondary">
                <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                Edit
              </a>
            }
            @if (r.actions.canSubmit) {
              <button
                type="button"
                [class]="btn.primary"
                [disabled]="busy()"
                (click)="act('submit')"
              >
                <i class="pi pi-send text-xs" aria-hidden="true"></i>
                Submit
              </button>
            }
            @if (r.actions.canApprove) {
              <button type="button" [class]="btn.primary" [disabled]="busy()" (click)="approve()">
                <i class="pi pi-check text-xs" aria-hidden="true"></i>
                Approve
              </button>
            }
            @if (r.actions.canSendBack) {
              <button
                type="button"
                [class]="btn.secondary"
                [disabled]="busy()"
                (click)="decide('send-back')"
              >
                <i class="pi pi-replay text-xs" aria-hidden="true"></i>
                Send Back
              </button>
            }
            @if (r.actions.canReject) {
              <button
                type="button"
                [class]="btn.danger"
                [disabled]="busy()"
                (click)="decide('reject')"
              >
                <i class="pi pi-times text-xs" aria-hidden="true"></i>
                Reject
              </button>
            }
            @if (r.actions.canRetryProvisioning) {
              <button
                type="button"
                [class]="btn.primary"
                [disabled]="busy()"
                (click)="act('retry-provisioning')"
              >
                <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
                Retry Provisioning
              </button>
            }
            @if (r.actions.canCancel) {
              <button type="button" [class]="btn.danger" [disabled]="busy()" (click)="cancel()">
                Cancel Request
              </button>
            }
          </div>
        </div>

        <dl
          [class]="
            card + ' grid grid-cols-2 gap-x-6 gap-y-3 !p-4 text-sm sm:grid-cols-4 xl:grid-cols-8'
          "
          aria-label="Request summary"
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
      </div>

      @if (r.status === 'FAILED' && r.failureReason) {
        <div
          role="alert"
          class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
        >
          <strong>Provisioning failed:</strong> {{ r.failureReason }}
        </div>
      }
      @if (r.status === 'PROVISIONING' && r.type === 'NEW_USER') {
        <div
          role="status"
          class="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
        >
          Account provisioned. The request completes once the user accepts the invitation and sets a
          password.
        </div>
      }

      <div class="flex flex-col gap-5 lg:flex-row">
        <nav aria-label="Request sections" class="lg:w-56 lg:shrink-0">
          <ul class="flex gap-1 overflow-x-auto lg:sticky lg:top-40 lg:flex-col">
            @for (s of sections(); track s.key) {
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
                  @if (s.key === 'notes' && r.notes.length) {
                    <span
                      class="ml-auto rounded-full bg-gray-200 px-1.5 text-[11px] dark:bg-white/10"
                      >{{ r.notes.length }}</span
                    >
                  }
                  @if (s.key === 'emails' && failedEmails()) {
                    <span
                      class="ml-auto rounded-full bg-red-500/15 px-1.5 text-[11px] text-red-500"
                      >{{ failedEmails() }}</span
                    >
                  }
                </button>
              </li>
            }
          </ul>
        </nav>

        <section [class]="card + ' min-w-0 flex-1'" [attr.aria-label]="sectionLabel()">
          <h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            {{ sectionLabel() }}
          </h2>

          @switch (section()) {
            @case ('access') {
              @if (accessLoading()) {
                <div class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
              } @else {
                <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  @for (f of accessLists(); track f.label) {
                    <div>
                      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {{ f.label }}
                      </p>
                      <p class="text-sm text-gray-900 dark:text-white">{{ f.value || '—' }}</p>
                    </div>
                  }
                </div>
                <zcc-access-preview [preview]="access()" [showCurrent]="r.type !== 'NEW_USER'" />
              }
            }

            @case ('approval') {
              @if (r.currentStep) {
                <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  Current step:
                  <strong>Level {{ r.currentStep.level }} · {{ r.currentStep.stepName }}</strong> —
                  {{ r.currentStep.approverName }}
                </p>
              }
              @if (r.approvals.length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr
                        class="border-b border-gray-200 bg-gray-50/80 text-left dark:border-white/10 dark:bg-white/5"
                      >
                        @for (h of approvalHeaders; track h) {
                          <th
                            scope="col"
                            class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300"
                          >
                            {{ h }}
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (a of r.approvals; track a.id) {
                        <tr>
                          <td class="px-4 py-2.5 tabular-nums">{{ a.level }}</td>
                          <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                            {{ a.stepName }}
                          </td>
                          <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ a.actionedByName ?? a.approverName ?? '—' }}
                          </td>
                          <td class="px-4 py-2.5">
                            <zcc-status-chip
                              [value]="a.status"
                              [label]="humanize(a.status)"
                              [tone]="$any(approvalTone(a.status))"
                            />
                          </td>
                          <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ dateTime(a.assignedAt) }}
                          </td>
                          <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ dateTime(a.actionedAt) }}
                          </td>
                          <td class="max-w-xs px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ a.comments ?? '—' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-sm text-gray-500">
                  The approval chain is created when the request is submitted.
                </p>
              }
              <ol
                class="mt-6 flex flex-wrap items-center gap-2 text-xs text-gray-500"
                aria-label="Workflow"
              >
                @for (step of workflow(); track step.label; let last = $last) {
                  <li class="flex items-center gap-2">
                    <span
                      class="rounded-full px-2.5 py-1 font-medium"
                      [class]="
                        step.done
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : step.active
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-white/5'
                      "
                      >{{ step.label }}</span
                    >
                    @if (!last) {
                      <i class="pi pi-angle-right" aria-hidden="true"></i>
                    }
                  </li>
                }
              </ol>
            }

            @case ('notes') {
              <form class="mb-6 space-y-3" (submit)="$event.preventDefault(); addNote()">
                <label
                  for="note-body"
                  class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                  >Add Note</label
                >
                <textarea
                  id="note-body"
                  rows="3"
                  maxlength="4000"
                  [class]="inputClass"
                  placeholder="Write a note…"
                  [value]="noteBody()"
                  (input)="noteBody.set($any($event.target).value)"
                ></textarea>
                <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <app-select-control
                    label="Note Type"
                    [searchable]="false"
                    [options]="noteTypeOptions"
                    [(value)]="noteType"
                  />
                  <app-select-control
                    label="Visibility"
                    [searchable]="false"
                    [options]="noteVisibilityOptions"
                    [(value)]="noteVisibility"
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
              <p class="mb-3 text-xs text-gray-400">
                Notes are append-only and cannot be edited once saved.
              </p>
              <ul class="space-y-3">
                @for (n of r.notes; track n.id) {
                  <li class="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ n.authorName }}
                      </p>
                      <div class="flex gap-1">
                        <zcc-status-chip
                          [value]="n.noteType"
                          [label]="optionLabel(noteTypeOptions, n.noteType)"
                          tone="blue"
                        />
                        <zcc-status-chip
                          [value]="n.visibility"
                          [label]="optionLabel(noteVisibilityOptions, n.visibility)"
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

            @case ('history') {
              <ol class="relative ml-2 border-l border-gray-200 dark:border-white/10">
                @for (e of r.events; track e.id; let last = $last) {
                  <li class="mb-6 ml-5 last:mb-0">
                    <span
                      class="absolute -left-[7px] mt-1 size-3.5 rounded-full ring-4 ring-white dark:ring-gray-900"
                      [class]="last ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/30'"
                      aria-hidden="true"
                    ></span>
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">
                      {{ e.toStatusLabel }}
                      @if (e.fromStatus && e.fromStatus !== e.toStatus) {
                        <span class="font-normal text-gray-400"
                          >from {{ humanize(e.fromStatus) }}</span
                        >
                      }
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ dateTime(e.createdAt) }} · {{ e.actorName ?? 'System' }}
                    </p>
                    @if (e.comments) {
                      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ e.comments }}</p>
                    }
                    @if (e.correlationId) {
                      <p class="mt-0.5 font-mono text-[11px] text-gray-400">
                        Correlation {{ e.correlationId }}
                      </p>
                    }
                  </li>
                }
              </ol>
            }

            @case ('emails') {
              @if (r.emails.length) {
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table class="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr
                        class="border-b border-gray-200 bg-gray-50/80 text-left dark:border-white/10 dark:bg-white/5"
                      >
                        @for (h of emailHeaders; track h) {
                          <th
                            scope="col"
                            class="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300"
                          >
                            {{ h }}
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                      @for (m of r.emails; track m.id) {
                        <tr>
                          <td class="px-4 py-2.5 font-mono text-[11px] text-gray-500">
                            {{ m.id.slice(0, 8) }}
                          </td>
                          <td class="px-4 py-2.5">{{ humanize(m.template) }}</td>
                          <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ m.recipient }}
                          </td>
                          <td class="px-4 py-2.5 text-gray-900 dark:text-white">{{ m.subject }}</td>
                          <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ m.trigger }}
                          </td>
                          <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {{ dateTime(m.sentAt ?? m.createdAt) }}
                          </td>
                          <td class="px-4 py-2.5">
                            <zcc-status-chip
                              [value]="m.deliveryStatus"
                              [label]="humanize(m.deliveryStatus)"
                              [tone]="$any(emailTone(m.deliveryStatus))"
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
                          <td class="px-4 py-2.5 tabular-nums">{{ m.attempts }}</td>
                          <td class="px-4 py-2.5">
                            <div class="flex justify-end gap-1">
                              <button
                                type="button"
                                [class]="btn.icon"
                                title="View email"
                                [attr.aria-label]="'View ' + m.subject"
                                (click)="viewEmail(m)"
                              >
                                <i class="pi pi-eye" aria-hidden="true"></i>
                              </button>
                              @if (r.actions.canRetryEmail && m.deliveryStatus === 'FAILED') {
                                <button
                                  type="button"
                                  [class]="btn.icon"
                                  title="Retry"
                                  [attr.aria-label]="'Retry ' + m.subject"
                                  [disabled]="busy()"
                                  (click)="retryEmail(m)"
                                >
                                  <i class="pi pi-refresh" aria-hidden="true"></i>
                                </button>
                              }
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-sm text-gray-500">No emails have been sent for this request.</p>
              }
            }

            @case ('audit') {
              @if (auditLoading()) {
                <div class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
              } @else {
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
                          a.action
                        }}</span>
                        <span class="text-gray-600 dark:text-gray-300">{{ a.actor }}</span>
                        <span class="text-gray-500">{{ a.module }} · {{ a.target }}</span>
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
                            Correlation:
                            <span class="font-mono">{{ a.correlationId ?? '—' }}</span> · IP:
                            {{ a.ipAddress ?? '—' }}
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
            }

            @default {
              <dl class="grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2">
                @for (f of fields(); track f.label) {
                  <div class="border-b border-gray-100 pb-2 dark:border-white/5">
                    <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {{ f.label }}
                    </dt>
                    <dd
                      class="mt-0.5 whitespace-pre-line break-words text-gray-900 dark:text-white"
                    >
                      @if (f.label === 'Attachment' && f.value) {
                        <a
                          [href]="f.value"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-indigo-500 hover:underline"
                          >{{ f.value }}</a
                        >
                      } @else {
                        {{ f.value || '—' }}
                      }
                    </dd>
                  </div>
                }
              </dl>
            }
          }
        </section>
      </div>
    }
  `,
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
