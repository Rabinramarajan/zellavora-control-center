import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { IAM_INPUT } from '../../shared/iam-page-header.component';

export interface MultiSelectOption {
  value: string;
  label: string;
}

let nextId = 0;

/** Checkbox dropdown with a filter box; two-way binds the selected values. */
@Component({
  selector: 'zcc-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', '(keydown.escape)': 'open.set(false)' },
  template: `
    <div class="relative">
      <button
        type="button"
        [id]="inputId()"
        [class]="inputClass + ' flex min-h-[40px] items-center justify-between gap-2 text-left'"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [disabled]="disabled()"
        (click)="open.set(!open())"
      >
        <span class="truncate" [class.text-gray-400]="!value().length">{{ summary() }}</span>
        <i class="pi pi-chevron-down text-xs text-gray-400" aria-hidden="true"></i>
      </button>
      @if (open()) {
        <div
          class="absolute z-30 mt-1 w-full min-w-[220px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-gray-900"
        >
          @if (options().length > 6) {
            <input
              type="search"
              [class]="inputClass + ' mb-2'"
              placeholder="Filter…"
              [attr.aria-label]="'Filter ' + placeholder()"
              [value]="filter()"
              (input)="filter.set($any($event.target).value)"
            />
          }
          <ul
            [id]="listId"
            role="listbox"
            aria-multiselectable="true"
            class="max-h-60 overflow-y-auto"
          >
            @for (opt of filtered(); track opt.value) {
              <li>
                <label
                  class="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    class="size-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                    [checked]="value().includes(opt.value)"
                    (change)="toggle(opt.value)"
                  />
                  {{ opt.label }}
                </label>
              </li>
            } @empty {
              <li class="px-2 py-3 text-center text-xs text-gray-400">No options</li>
            }
          </ul>
          @if (value().length) {
            <button
              type="button"
              class="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-indigo-500 hover:bg-indigo-500/10"
              (click)="value.set([])"
            >
              Clear selection
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class MultiSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input<MultiSelectOption[]>([]);
  readonly placeholder = input('Any');
  readonly inputId = input(`zcc-multi-select-${nextId++}`);
  readonly disabled = input(false);
  readonly value = model<string[]>([]);

  protected readonly inputClass = IAM_INPUT;
  protected readonly listId = `zcc-multi-select-list-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly filter = signal('');

  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  protected readonly summary = computed(() => {
    const selected = this.value();
    if (!selected.length) return this.placeholder();
    if (selected.length === 1) {
      return this.options().find((o) => o.value === selected[0])?.label ?? '1 selected';
    }
    return `${selected.length} selected`;
  });

  protected toggle(v: string): void {
    const current = this.value();
    this.value.set(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }
}
