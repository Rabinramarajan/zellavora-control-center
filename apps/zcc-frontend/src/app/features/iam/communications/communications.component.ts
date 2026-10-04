import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import {
  Audience,
  AudienceType,
  CommunicationHistoryItem,
  CommunicationSearchCriteria,
  DeliverySummary,
  MessageType,
} from '../../../shared/models/iam-admin.model';
import { SEARCH_ENDPOINTS } from '../../../core/api/search-endpoints';
import { countActiveFilters, createSearchStore } from '../../../shared/search';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import {
  PageChangeEvent,
  PaginationComponent,
} from '../../../shared/components/pagination/pagination.component';
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
  templateUrl: './communications.component.html',
  styleUrl: './communications.component.scss',
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

  private readonly route = inject(ActivatedRoute);
  protected readonly channel = toSignal(
    this.route.data.pipe(map((d) => (d['channel'] as Channel) ?? 'in_app')),
    { initialValue: (this.route.snapshot.data['channel'] as Channel) ?? 'in_app' }
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

  /** Message Search or Email Communication Search, by the route's channel. */
  readonly history = createSearchStore<CommunicationSearchCriteria, CommunicationHistoryItem>({
    endpoint: this.channel() === 'email' ? SEARCH_ENDPOINTS.emails : SEARCH_ENDPOINTS.messages,
  });

  protected readonly historySubject = signal('');
  protected readonly historyFrom = signal('');
  protected readonly historyTo = signal('');
  protected readonly historyFiltered = computed(
    () => countActiveFilters(this.history.criteria()) > 0
  );

  protected searchHistory(event: Event): void {
    event.preventDefault();
    void this.history.search({
      subject: this.historySubject().trim() || null,
      sentFromDate: this.historyFrom() || null,
      sentToDate: this.historyTo() || null,
    });
  }

  protected resetHistory(): void {
    this.historySubject.set('');
    this.historyFrom.set('');
    this.historyTo.set('');
    void this.history.reset();
  }

  protected onPaginate({ page, pageSize }: PageChangeEvent): void {
    void this.history.setPage(page, pageSize);
  }

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
