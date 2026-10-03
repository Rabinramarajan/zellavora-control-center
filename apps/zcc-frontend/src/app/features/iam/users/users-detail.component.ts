import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { UserAdminApiService } from '../../../core/api/user-admin.api';
import { UserAccess, UserAccessGroup, UserProfile } from '../../../shared/models/user-admin.model';
import { EmptyStateComponent } from '../../../shared/components/iam';
import { IAM_BTN } from '../shared/iam-page-header.component';
import { errorMessage } from '../shared/iam-feedback.service';
import { formatDate } from '../shared/iam-format';
import { ActionMeta, REQUEST_CHANGE_META, RequestChangeType } from '../../users/user-actions';

type SectionKey = 'user' | 'employment' | 'groups' | 'branches' | 'teams';

interface Field {
  label: string;
  value: string | null | undefined;
}

/**
 * Read-only User Details. Every change is raised through "Request Change", which opens
 * a prefilled User Request (request → approval → provisioning).
 */
@Component({
  selector: 'zcc-users-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, EmptyStateComponent],
  host: { '(document:click)': 'changeOpen.set(false)' },
  templateUrl: './users-detail.component.html',
  styleUrl: './users-detail.component.scss',
})
export class UsersDetailComponent {
  private readonly api = inject(UserAdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly userId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly btn = IAM_BTN;
  protected readonly date = formatDate;

  protected readonly user = signal<UserProfile | null>(null);
  protected readonly access = signal<UserAccess | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly changeOpen = signal(false);
  protected readonly collapsed = signal<ReadonlySet<SectionKey>>(new Set());

  protected readonly changes = computed(() => this.user()?.requestableChanges ?? []);

  protected readonly userFields = computed<Field[]>(() => {
    const p = this.user()?.personal;
    if (!p) return [];
    return [
      { label: 'User Name', value: p.username },
      { label: 'First Name', value: p.firstName },
      { label: 'Middle Name', value: p.middleName },
      { label: 'Last Name', value: p.lastName },
      { label: 'Date of Birth', value: this.day(p.dateOfBirth) },
      { label: 'Gender', value: this.humanize(p.gender) },
    ];
  });

  protected readonly familyFields = computed<Field[]>(() => {
    const f = this.user()?.family;
    if (!f) return [];
    return [
      { label: 'Father Name', value: f.fatherName },
      { label: 'Mother Name', value: f.motherName },
      { label: 'Marital Status', value: this.humanize(f.maritalStatus) },
      { label: 'Spouse Name', value: f.spouseName },
      { label: 'Spouse Date of Birth', value: this.day(f.spouseDateOfBirth) },
    ];
  });

  protected readonly contactFields = computed<Field[]>(() => {
    const c = this.user()?.contact;
    if (!c) return [];
    return [
      { label: 'Email ID', value: c.workEmail },
      { label: 'Contact No', value: c.mobile },
    ];
  });

  protected readonly employmentLeft = computed<Field[]>(() => {
    const e = this.user()?.employee;
    if (!e) return [];
    return [
      { label: 'Employee Code', value: e.employeeCode },
      { label: 'Begin Date', value: this.day(e.joiningDate) },
      { label: 'End Date', value: this.day(e.endDate) },
      { label: 'Designation', value: e.designation },
    ];
  });

  protected readonly employmentRight = computed<Field[]>(() => {
    const o = this.user()?.organization;
    if (!o) return [];
    return [
      { label: 'Branch', value: o.branch?.name },
      { label: 'Location', value: o.location },
      { label: 'Department', value: o.department?.name },
      { label: 'Team', value: o.team?.name },
    ];
  });

  /** Groups bucketed by type, shown as sub-headings in the Group Details table. */
  protected readonly groupsByType = computed(() => {
    const buckets = new Map<string, UserAccessGroup[]>();
    for (const g of this.access()?.groups ?? []) {
      const type = this.humanize(g.type) ?? 'Other';
      buckets.set(type, [...(buckets.get(type) ?? []), g]);
    }
    return [...buckets.entries()].map(([type, groups]) => ({ type, groups }));
  });

  public constructor() {
    effect(() => {
      const id = this.userId();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      const [profile, access] = await Promise.all([
        firstValueFrom(this.api.profile(id)),
        firstValueFrom(this.api.access(id)),
      ]);
      this.user.set(profile);
      this.access.set(access);
      this.loadError.set(null);
    } catch (err) {
      this.loadError.set(errorMessage(err, 'User not found.'));
    }
  }

  protected reload(): void {
    const id = this.userId();
    if (id) void this.load(id);
  }

  protected isOpen(key: SectionKey): boolean {
    return !this.collapsed().has(key);
  }

  protected toggle(key: SectionKey): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected requestChange(type: RequestChangeType): void {
    this.changeOpen.set(false);
    void this.router.navigate(['/iam/user-requests/create'], {
      queryParams: { type, userId: this.user()!.id },
    });
  }

  protected changeMeta(type: RequestChangeType): ActionMeta {
    return REQUEST_CHANGE_META[type];
  }

  protected day(iso: string | null | undefined): string | null {
    return iso ? formatDate(iso) : null;
  }

  private humanize(value: string | null | undefined): string | null {
    if (!value) return null;
    return value
      .toLowerCase()
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
