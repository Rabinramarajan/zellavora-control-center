import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { ConfigurationItem, UpsertConfigurationRequest } from '@shared/models/iam-admin.model';
import { createListStore } from '@shared/utils/create-list-store';
import { DataTableComponent, DataTableColumn, EmptyStateComponent } from '@shared/components/iam';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_INPUT, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { FormField, FormValues } from '../shared/iam-form-dialog.component';
import { relativeTime } from '../shared/iam-format';

const KEY_PATTERN = {
  regex: /^[a-z][a-z0-9_.-]*$/,
  message: 'Lowercase letters, digits, ".", "-" and "_", starting with a letter.',
};

@Component({
  selector: 'zcc-configuration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, DataTableComponent, EmptyStateComponent, PaginationComponent],
  template: `
    <zcc-iam-page-header
      title="Common Configuration"
      icon="pi pi-cog"
      description="Organization-wide key/value settings. Encrypted values are write-only and never shown again after saving."
    >
      <button type="button" [class]="btn.primary" (click)="create()">
        <i class="pi pi-plus text-xs" aria-hidden="true"></i>
        New entry
      </button>
    </zcc-iam-page-header>

    <div class="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
      <div>
        <label for="cfg-search" class="sr-only">Search configuration</label>
        <input
          id="cfg-search"
          type="search"
          placeholder="Search keys or values…"
          [class]="inputClass + ' min-h-[40px]'"
          [value]="store.q()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>
      <div>
        <label for="cfg-category" class="sr-only">Filter by category</label>
        <select
          id="cfg-category"
          [class]="inputClass + ' min-h-[40px]'"
          (change)="onCategory($any($event.target).value)"
        >
          <option value="">All categories</option>
          @for (c of categories(); track c) {
            <option [value]="c" [selected]="store.filters()['category'] === c">{{ c }}</option>
          }
        </select>
      </div>
    </div>

    @if (store.loading() && !store.hasItems()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4]; track $index) {
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load configuration"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table [columns]="columns" [rows]="store.items()" [rowTemplate]="rowTpl">
        <ng-template #rowTpl let-c>
          <td class="px-4 py-3 font-mono text-xs font-semibold text-gray-900 dark:text-white">
            {{ c.key }}
          </td>
          <td class="max-w-sm px-4 py-3">
            @if (c.isEncrypted) {
              <span class="inline-flex items-center gap-1.5 text-gray-500"
                ><i class="pi pi-lock text-xs" aria-hidden="true"></i
                ><span class="sr-only">Encrypted value</span>{{ c.value }}</span
              >
            } @else {
              <span
                class="line-clamp-2 break-all font-mono text-xs text-gray-600 dark:text-gray-300"
                [title]="c.value"
                >{{ c.value }}</span
              >
            }
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ c.category ?? '—' }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ relative(c.updatedAt) }}</td>
          <td class="px-4 py-3 text-right">
            <div class="flex justify-end gap-1">
              <button
                type="button"
                [class]="btn.icon"
                [attr.aria-label]="'Edit ' + c.key"
                title="Edit"
                (click)="edit(c)"
              >
                <i class="pi pi-pencil" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                [class]="btn.icon + ' hover:!text-red-500'"
                [attr.aria-label]="'Delete ' + c.key"
                title="Delete"
                [disabled]="busyKey() === c.key"
                (click)="remove(c)"
              >
                <i class="pi pi-trash" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </ng-template>
      </zcc-data-table>
      <app-pagination
        class="px-1 py-3"
        entityLabel="entries"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-cog"
        title="No configuration entries"
        [message]="
          store.q() ? 'Nothing matches your search.' : 'Add a key/value entry to get started.'
        "
      />
    }
  `,
})
export class ConfigurationComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly relative = relativeTime;
  protected readonly categories = signal<string[]>([]);
  protected readonly busyKey = signal<string | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly columns: DataTableColumn[] = [
    { key: 'key', label: 'Key' },
    { key: 'value', label: 'Value' },
    { key: 'category', label: 'Category' },
    { key: 'updated', label: 'Updated' },
    { key: 'actions', label: '' },
  ];

  readonly store = createListStore<ConfigurationItem>({
    initialPageSize: 50,
    filterKeys: ['category'],
    loader: async (query) => {
      const list = await firstValueFrom(this.api.listConfigurations(query));
      this.categories.set(list.categories);
      return list;
    },
  });

  protected onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(q.trim()), 300);
  }

  protected onCategory(category: string): void {
    this.store.setFilters(category ? { category } : {});
  }

  protected async create(): Promise<void> {
    const result = await this.dialogs.form({
      title: 'New configuration entry',
      submitText: 'Create',
      fields: this.fields(),
      submit: (v) => this.save(v),
    });
    if (result) await this.afterSave(`${result['key']} saved.`);
  }

  protected async edit(c: ConfigurationItem): Promise<void> {
    const result = await this.dialogs.form({
      title: `Edit ${c.key}`,
      fields: this.fields(c),
      submit: (v) => this.save({ ...v, key: c.key }, c),
    });
    if (result) await this.afterSave(`${c.key} saved.`);
  }

  protected async remove(c: ConfigurationItem): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Delete entry?',
      `${c.key} will be permanently removed. Anything reading it will fall back to its default.`,
      'Delete'
    );
    if (!ok) return;
    this.busyKey.set(c.key);
    try {
      await firstValueFrom(this.api.deleteConfiguration(c.key));
      this.feedback.success(`${c.key} deleted.`);
      await this.store.reload();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busyKey.set(null);
    }
  }

  private fields(current?: ConfigurationItem): FormField[] {
    const keepSecret = !!current?.isEncrypted;
    return [
      {
        key: 'key',
        label: 'Key',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'e.g. billing.invoice_prefix',
        pattern: KEY_PATTERN,
        value: current?.key,
        disabled: !!current,
      },
      {
        key: 'value',
        label: 'Value',
        type: 'textarea',
        // An existing secret can be kept by leaving the value blank.
        required: !keepSecret,
        maxLength: 10000,
        value: current && !current.isEncrypted ? current.value : null,
        hint: keepSecret ? 'Leave blank to keep the current secret.' : undefined,
      },
      {
        key: 'category',
        label: 'Category',
        type: 'text',
        maxLength: 60,
        value: current?.category,
        placeholder: 'e.g. billing',
      },
      {
        key: 'isEncrypted',
        label: 'Encrypt this value',
        type: 'toggle',
        value: current?.isEncrypted ?? false,
        hint: 'Stored encrypted and never displayed again. Use for API keys and other secrets.',
      },
    ];
  }

  private save(v: FormValues, current?: ConfigurationItem): Promise<unknown> {
    const value = (v['value'] as string | null) ?? '';
    const isEncrypted = !!v['isEncrypted'];
    if (!value && current?.isEncrypted && !isEncrypted) {
      return Promise.reject(new Error('Enter a value to store this entry unencrypted.'));
    }
    const body: UpsertConfigurationRequest = {
      key: String(v['key']),
      category: (v['category'] as string) || null,
      isEncrypted,
      ...(value || !(current?.isEncrypted && isEncrypted) ? { value } : {}),
    };
    return firstValueFrom(this.api.upsertConfiguration(body));
  }

  private async afterSave(message: string): Promise<void> {
    this.feedback.success(message);
    await this.store.reload();
  }
}
