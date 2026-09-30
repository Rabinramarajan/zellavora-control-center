import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { IAM_INPUT } from '../../shared/iam-page-header.component';

export interface SelectedUser {
  id: string;
  name: string;
  email: string;
}

let nextId = 0;

/** Typeahead over the user directory; emits the chosen user and binds its id. */
@Component({
  selector: 'zcc-user-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', '(keydown.escape)': 'open.set(false)' },
  template: `
    <div class="relative">
      @if (value() && selectedLabel()) {
        <div [class]="inputClass + ' flex min-h-[40px] items-center justify-between gap-2'">
          <span class="truncate">{{ selectedLabel() }}</span>
          @if (!disabled()) {
            <button
              type="button"
              class="inline-flex size-6 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
              [attr.aria-label]="'Clear ' + placeholder()"
              (click)="clear()"
            >
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          }
        </div>
      } @else {
        <input
          type="search"
          role="combobox"
          autocomplete="off"
          [id]="inputId()"
          [class]="inputClass + ' min-h-[40px]'"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="listId"
          [value]="query()"
          (input)="onInput($any($event.target).value)"
          (focus)="onInput(query())"
        />
      }
      @if (open()) {
        <ul
          [id]="listId"
          role="listbox"
          class="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-gray-900"
        >
          @if (loading()) {
            <li class="px-3 py-2 text-xs text-gray-400">Searching…</li>
          }
          @for (u of results(); track u.id) {
            <li role="option" [attr.aria-selected]="false">
              <button
                type="button"
                class="flex min-h-[44px] w-full flex-col items-start rounded-md px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
                (click)="choose(u)"
              >
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ u.name }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ u.email }}</span>
              </button>
            </li>
          } @empty {
            @if (!loading()) {
              <li class="px-3 py-2 text-xs text-gray-400">No matching users</li>
            }
          }
        </ul>
      }
    </div>
  `,
})
export class UserSelectComponent {
  private readonly iam = inject(IamApiService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly placeholder = input('Search users…');
  readonly inputId = input(`zcc-user-select-${nextId++}`);
  readonly disabled = input(false);
  /** Display label for a pre-selected id (e.g. when editing). */
  readonly initialLabel = input<string | null>(null);
  readonly value = model<string | null>(null);
  readonly selected = output<SelectedUser | null>();

  protected readonly inputClass = IAM_INPUT;
  protected readonly listId = `zcc-user-select-list-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly query = signal('');
  protected readonly results = signal<SelectedUser[]>([]);
  private readonly chosenLabel = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected selectedLabel(): string | null {
    return this.chosenLabel() ?? this.initialLabel();
  }

  protected onInput(q: string): void {
    this.query.set(q);
    this.open.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(q.trim()), 250);
  }

  private async search(q: string): Promise<void> {
    const seq = ++this.seq;
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.iam.listIamUsers({ q, page: 1, pageSize: 10 }));
      if (seq !== this.seq) return;
      this.results.set(res.data.data.map((u) => ({ id: u.id, name: u.fullName, email: u.email })));
    } catch {
      if (seq === this.seq) this.results.set([]);
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  protected choose(u: SelectedUser): void {
    this.chosenLabel.set(`${u.name} · ${u.email}`);
    this.value.set(u.id);
    this.selected.emit(u);
    this.open.set(false);
    this.query.set('');
  }

  protected clear(): void {
    this.chosenLabel.set(null);
    this.value.set(null);
    this.selected.emit(null);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }
}
