import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import {
  Audience,
  AudienceType,
  CommunicationHistoryItem,
  DeliverySummary,
  MessageType,
} from '../../../shared/models/iam-admin.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import {
  IAM_BTN,
  IAM_CARD,
  IAM_INPUT,
  IamPageHeaderComponent,
} from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { PickerOption } from '../shared/entity-picker-dialog.component';
import { formatDateTime, relativeTime } from '../shared/iam-format';

type Channel = 'in_app' | 'email';

const AUDIENCES: Array<{ type: AudienceType; label: string; noun: string }> = [
  { type: 'all', label: 'Everyone', noun: 'members' },
  { type: 'users', label: 'Users', noun: 'users' },
  { type: 'group', label: 'Groups', noun: 'groups' },
  { type: 'team', label: 'Teams', noun: 'teams' },
  { type: 'department', label: 'Departments', noun: 'departments' },
];

const MESSAGE_TYPES: Array<{ value: MessageType; label: string }> = [
  { value: 'info', label: 'Information' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Critical' },
];

const LIMITS = { title: 150, subject: 200, message: 5000, email: 20000 };

@Component({
  selector: 'zcc-communications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, EmptyStateComponent, StatusChipComponent, PaginationComponent],
  template: `
    <zcc-iam-page-header
      [title]="isEmail() ? 'Email Communication' : 'Messages'"
      [icon]="isEmail() ? 'pi pi-envelope' : 'pi pi-comments'"
      [description]="
        isEmail()
          ? 'Email active members. Each recipient gets their own copy, so addresses stay private.'
          : 'Send an in-app notification to active members. It appears in their notification centre.'
      "
    />

    <div class="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form
        [class]="card + ' space-y-5'"
        novalidate
        (submit)="send($event)"
        aria-labelledby="compose-heading"
      >
        <h2 id="compose-heading" class="text-base font-semibold text-gray-900 dark:text-white">
          Compose
        </h2>

        <fieldset>
          <legend class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Recipients
          </legend>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Audience">
            @for (a of audiences; track a.type) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="audienceType() === a.type"
                class="min-h-[40px] rounded-lg border px-3 text-sm font-medium transition-colors"
                [class]="
                  audienceType() === a.type
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-white/10 dark:text-gray-300'
                "
                (click)="setAudienceType(a.type)"
              >
                {{ a.label }}
              </button>
            }
          </div>

          @if (audienceType() !== 'all') {
            <div class="mt-3 flex flex-wrap items-center gap-2">
              @for (item of selected(); track item.id) {
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm text-gray-700 dark:bg-white/10 dark:text-gray-200"
                >
                  {{ item.label }}
                  <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/15"
                    [attr.aria-label]="'Remove ' + item.label"
                    (click)="unselect(item.id)"
                  >
                    <i class="pi pi-times text-[10px]" aria-hidden="true"></i>
                  </button>
                </span>
              }
              <button type="button" [class]="btn.secondary" (click)="pickAudience()">
                <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                Choose {{ audienceNoun() }}
              </button>
            </div>
            @if (submitted() && !selected().length) {
              <p class="mt-1 text-xs text-red-500">Choose at least one recipient.</p>
            }
          } @else {
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Every active member of your organization.
            </p>
          }
        </fieldset>

        @if (!isEmail()) {
          <div>
            <label
              for="msg-type"
              class="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200"
              >Type</label
            >
            <select
              id="msg-type"
              [class]="inputClass + ' min-h-[42px] sm:w-56'"
              (change)="messageType.set($any($event.target).value)"
            >
              @for (t of messageTypes; track t.value) {
                <option [value]="t.value" [selected]="messageType() === t.value">
                  {{ t.label }}
                </option>
              }
            </select>
          </div>
        }

        <div>
          <label
            for="msg-subject"
            class="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            {{ isEmail() ? 'Subject' : 'Title' }}
            <span class="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="msg-subject"
            type="text"
            [attr.maxlength]="subjectLimit()"
            [class]="inputClass + ' min-h-[42px]'"
            [attr.aria-invalid]="submitted() && !subject().trim()"
            [value]="subject()"
            (input)="subject.set($any($event.target).value)"
          />
          @if (submitted() && !subject().trim()) {
            <p class="mt-1 text-xs text-red-500">
              {{ isEmail() ? 'Subject' : 'Title' }} is required.
            </p>
          }
        </div>

        <div>
          <label
            for="msg-body"
            class="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            Message <span class="text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="msg-body"
            [rows]="isEmail() ? 10 : 6"
            [attr.maxlength]="bodyLimit()"
            [class]="inputClass"
            aria-describedby="msg-body-hint"
            [attr.aria-invalid]="submitted() && !body().trim()"
            [value]="body()"
            (input)="body.set($any($event.target).value)"
          ></textarea>
          <p
            id="msg-body-hint"
            class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
          >
            <span [class.text-red-500]="submitted() && !body().trim()">
              {{
                submitted() && !body().trim()
                  ? 'Message is required.'
                  : isEmail()
                    ? 'Plain text. Blank lines start a new paragraph.'
                    : 'Plain text.'
              }}
            </span>
            <span class="tabular-nums">{{ body().length }} / {{ bodyLimit() }}</span>
          </p>
        </div>

        <div class="flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
          <button type="submit" [class]="btn.primary" [disabled]="sending()">
            <i class="pi pi-send text-xs" aria-hidden="true"></i>
            {{ sending() ? 'Sending…' : isEmail() ? 'Send email' : 'Send message' }}
          </button>
          <button type="button" [class]="btn.secondary" [disabled]="sending()" (click)="clear()">
            Clear
          </button>
        </div>
      </form>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" class="mb-3 text-base font-semibold text-gray-900 dark:text-white">
          Recently sent
        </h2>
        @if (history.loading() && !history.hasItems()) {
          <div class="space-y-2">
            @for (_ of [1, 2, 3]; track $index) {
              <div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
            }
          </div>
        } @else if (history.error()) {
          <zcc-empty-state
            icon="pi pi-exclamation-triangle"
            title="Failed to load history"
            [message]="history.error()!"
          />
        } @else if (history.hasItems()) {
          <ul class="space-y-2">
            @for (h of history.items(); track h.id) {
              <li [class]="card + ' !p-4'">
                <div class="flex items-start justify-between gap-3">
                  <p class="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                    {{ h.subject }}
                  </p>
                  @if (h.type) {
                    <zcc-status-chip [value]="h.type" [label]="typeLabel(h.type)" />
                  }
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ audienceLabel(h) }} · {{ h.delivered }}/{{ h.recipients }} delivered
                  @if (h.failed) {
                    <span class="text-red-500">· {{ h.failed }} failed</span>
                  }
                </p>
                <p class="mt-1 text-xs text-gray-400" [title]="dateTime(h.sentAt)">
                  {{ h.sentByName ?? 'Unknown' }} · {{ relative(h.sentAt) }}
                </p>
              </li>
            }
          </ul>
          <app-pagination
            class="px-1 py-3"
            [totalItems]="history.total()"
            [page]="history.page()"
            [pageSize]="history.pageSize()"
            [showSummary]="false"
            (pageChange)="history.setPage($event)"
          />
        } @else {
          <zcc-empty-state
            [icon]="isEmail() ? 'pi pi-envelope' : 'pi pi-comments'"
            title="Nothing sent yet"
            message="Sent items appear here."
          />
        }
      </section>
    </div>
  `,
})
export class CommunicationsComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly audiences = AUDIENCES;
  protected readonly messageTypes = MESSAGE_TYPES;
  protected readonly relative = relativeTime;
  protected readonly dateTime = formatDateTime;

  protected readonly channel = toSignal(
    inject(ActivatedRoute).data.pipe(map((d) => (d['channel'] as Channel) ?? 'in_app')),
    { initialValue: 'in_app' as Channel }
  );
  protected readonly isEmail = computed(() => this.channel() === 'email');
  protected readonly subjectLimit = computed(() =>
    this.isEmail() ? LIMITS.subject : LIMITS.title
  );
  protected readonly bodyLimit = computed(() => (this.isEmail() ? LIMITS.email : LIMITS.message));

  protected readonly audienceType = signal<AudienceType>('all');
  protected readonly selected = signal<PickerOption[]>([]);
  protected readonly subject = signal('');
  protected readonly body = signal('');
  protected readonly messageType = signal<MessageType>('info');
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly audienceNoun = computed(
    () => AUDIENCES.find((a) => a.type === this.audienceType())?.noun ?? 'recipients'
  );

  readonly history = createListStore<CommunicationHistoryItem>({
    initialPageSize: 10,
    loader: (query) =>
      firstValueFrom(this.api.listCommunicationHistory({ ...query, channel: this.channel() })),
  });

  protected setAudienceType(type: AudienceType): void {
    if (type === this.audienceType()) return;
    this.audienceType.set(type);
    this.selected.set([]);
  }

  protected unselect(id: string): void {
    this.selected.update((list) => list.filter((i) => i.id !== id));
  }

  protected async pickAudience(): Promise<void> {
    const type = this.audienceType();
    const search = {
      users: this.dialogs.searchUsers,
      group: this.dialogs.searchGroups,
      team: this.dialogs.searchTeams,
      department: this.dialogs.searchDepartments,
      all: this.dialogs.searchUsers,
    }[type];
    // Keep labels for chips: remember every option the picker showed.
    const seen = new Map<string, PickerOption>();
    const ids = await this.dialogs.pick({
      title: `Choose ${this.audienceNoun()}`,
      confirmText: 'Choose',
      excludeIds: this.selected().map((s) => s.id),
      search: async (q) => {
        const options = await search(q);
        options.forEach((o) => seen.set(o.id, o));
        return options;
      },
    });
    if (!ids) return;
    this.selected.update((list) => [...list, ...ids.map((id) => seen.get(id)!).filter(Boolean)]);
  }

  protected clear(): void {
    this.subject.set('');
    this.body.set('');
    this.selected.set([]);
    this.audienceType.set('all');
    this.messageType.set('info');
    this.submitted.set(false);
  }

  protected typeLabel(type: MessageType): string {
    return MESSAGE_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  protected audienceLabel(h: CommunicationHistoryItem): string {
    if (!h.audience || h.audience.type === 'all') return 'Everyone';
    const noun = AUDIENCES.find((a) => a.type === h.audience!.type)?.noun ?? 'recipients';
    return `${h.audience.count ?? 0} ${noun}`;
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    const type = this.audienceType();
    if (
      !this.subject().trim() ||
      !this.body().trim() ||
      (type !== 'all' && !this.selected().length)
    )
      return;

    const audience: Audience =
      type === 'all' ? { type: 'all' } : { type, ids: this.selected().map((s) => s.id) };
    const who = type === 'all' ? 'every active member' : `the selected ${this.audienceNoun()}`;
    const ok = await this.dialogs.confirm(
      this.isEmail() ? 'Send email?' : 'Send message?',
      `“${this.subject().trim()}” will be sent to ${who}. This can't be undone.`,
      'Send',
      false
    );
    if (!ok) return;

    this.sending.set(true);
    try {
      const summary: DeliverySummary = this.isEmail()
        ? await firstValueFrom(
            this.api.sendEmail({
              audience,
              subject: this.subject().trim(),
              body: this.body().trim(),
            })
          )
        : await firstValueFrom(
            this.api.sendMessage({
              audience,
              title: this.subject().trim(),
              body: this.body().trim(),
              type: this.messageType(),
            })
          );
      if (summary.failed) {
        this.feedback.error({
          status: 400,
          message: `Delivered to ${summary.delivered} of ${summary.recipients}; ${summary.failed} failed.`,
        });
      } else {
        this.feedback.success(
          `Sent to ${summary.delivered} ${summary.delivered === 1 ? 'person' : 'people'}.`
        );
      }
      this.clear();
      await this.history.reload();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.sending.set(false);
    }
  }
}
