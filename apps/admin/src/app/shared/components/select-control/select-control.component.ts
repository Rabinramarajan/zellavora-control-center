import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  HostListener,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NgControl, Validators } from '@angular/forms';
import {
  DEFAULT_VALIDATION_MESSAGES,
  INPUT_VALIDATION_MESSAGES,
  InputControlSize,
  ValidationMessageMap,
  resolveValidationMessage,
} from '../input-control/input-control.types';
import { OptionAccessor, defaultCompareWith, readOption } from './select-control.types';

let nextUniqueId = 0;

/**
 * Searchable single-select.
 *
 * Binds like any native control because it registers itself as the
 * `valueAccessor` of the host `NgControl` — the same approach as
 * `InputControlComponent`, so reactive and template-driven both work:
 *
 *   <zc-select-control
 *     formControlName="clientCode"
 *     label="Organization"
 *     [options]="allOrgs()"
 *     [loading]="loadingOrgs()"
 *     optionLabel="name"
 *     optionSublabel="clientCode"
 *     optionValue="clientCode"
 *     placeholder="Select Organization"
 *     searchable
 *     (selectionChange)="applyTenantTheme($event)" />
 *
 * Option rows can be fully customised without forking the component:
 *
 *   <ng-template #option let-org>…your markup…</ng-template>
 */
@Component({
  selector: 'zc-select-control',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5" [class.opacity-60]="isDisabled()">
      @if (label()) {
        <!-- Mirrors .field-label from auth-shell.css; view encapsulation stops
             the parent's class from reaching in here. -->
        <label
          [attr.for]="triggerId()"
          class="block text-[11px] font-semibold tracking-[0.04em] text-slate-300"
        >
          {{ label() }}
          @if (showRequiredMarker()) {
            <span class="text-red-400 ml-0.5" aria-hidden="true">*</span>
          }
        </label>
      }

      <div class="relative">
        <!-- Trigger -->
        <button
          #trigger
          type="button"
          [id]="triggerId()"
          role="combobox"
          [attr.aria-expanded]="isOpen()"
          [attr.aria-controls]="panelId()"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-invalid]="showError() ? 'true' : null"
          [attr.aria-required]="showRequiredMarker() ? 'true' : null"
          aria-haspopup="listbox"
          [disabled]="isDisabled()"
          [class]="triggerClasses()"
          (click)="toggle()"
          (keydown)="onTriggerKeydown($event)"
          (blur)="markTouched()"
        >
          @if (prefixIcon()) {
            <span
              class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none"
            >
              <i [class]="'pi ' + prefixIcon()" aria-hidden="true"></i>
            </span>
          }

          <span class="truncate" [class.text-slate-500]="!selectedOption()">
            {{ triggerLabel() }}
          </span>

          <span class="flex items-center gap-1 shrink-0">
            @if (canClear()) {
              <span
                role="button"
                tabindex="-1"
                class="p-1 rounded-md text-slate-400 hover:text-white transition-colors"
                aria-label="Clear selection"
                (click)="onClearClick($event)"
              >
                <i class="pi pi-times text-[11px]" aria-hidden="true"></i>
              </span>
            }
            <svg
              class="w-4 h-4 text-slate-400 transition-transform"
              [class.rotate-180]="isOpen()"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </button>

        <!-- Panel -->
        @if (isOpen()) {
          <div
            [id]="panelId()"
            class="absolute z-20 w-full mt-2 rounded-2xl border border-white/10 bg-[#0b0e1c] shadow-2xl p-3 space-y-2 backdrop-blur-xl"
          >
            @if (searchable()) {
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  #search
                  type="text"
                  [value]="searchQuery()"
                  [attr.placeholder]="searchPlaceholder()"
                  [attr.aria-label]="searchPlaceholder()"
                  autocomplete="off"
                  class="w-full pl-8 pr-4 py-2 rounded-lg border border-white/5 bg-white/5 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
                  (input)="onSearch($event)"
                  (keydown)="onSearchKeydown($event)"
                />
              </div>
            }

            <div
              #list
              role="listbox"
              [attr.aria-label]="label() || 'Options'"
              class="overflow-y-auto space-y-1 pr-1"
              [style.max-height.px]="panelMaxHeight()"
            >
              @if (loading()) {
                <div class="text-center py-4 text-slate-500 text-[13px]">{{ loadingText() }}</div>
              } @else {
                @for (option of filteredOptions(); track trackOption(option, $index); let i = $index) {
                  <button
                    type="button"
                    role="option"
                    [id]="optionId(i)"
                    [attr.aria-selected]="isSelected(option)"
                    [disabled]="isOptionDisabled(option)"
                    [class]="optionClasses(option, i)"
                    (click)="select(option)"
                    (mouseenter)="activeIndex.set(i)"
                  >
                    @if (optionTemplate()) {
                      <ng-container
                        [ngTemplateOutlet]="optionTemplate()!"
                        [ngTemplateOutletContext]="{
                          $implicit: option,
                          selected: isSelected(option),
                          index: i
                        }"
                      />
                    } @else {
                      <span class="font-medium truncate">{{ labelOf(option) }}</span>
                      @if (sublabelOf(option)) {
                        <span class="text-[11px] text-slate-500 font-semibold uppercase">
                          ({{ sublabelOf(option) }})
                        </span>
                      }
                      @if (isSelected(option)) {
                        <i class="pi pi-check text-[11px] ml-auto text-indigo-400" aria-hidden="true"></i>
                      }
                    }
                  </button>
                } @empty {
                  <div class="text-center py-4 text-slate-500 text-[13px]">{{ emptyText() }}</div>
                }
              }
            </div>
          </div>
        }
      </div>

      @if (showError()) {
        <p [id]="errorId()" class="mt-1.5 text-[12px] text-red-400" role="alert">
          {{ errorMessage() }}
        </p>
      } @else if (hint()) {
        <p [id]="hintId()" class="text-[12px] text-slate-500">{{ hint() }}</p>
      }
    </div>
  `,
})
export class SelectControlComponent<T = any> implements ControlValueAccessor, DoCheck {
  // --- Data ----------------------------------------------------------------
  readonly options = input<readonly T[]>([]);
  readonly loading = input(false);
  readonly optionLabel = input<OptionAccessor<T, string>>('label');
  readonly optionSublabel = input<OptionAccessor<T, string> | null>(null);
  /** Omit to bind the whole option object as the control value. */
  readonly optionValue = input<OptionAccessor<T> | null>(null);
  readonly optionDisabled = input<OptionAccessor<T, boolean> | null>(null);
  readonly compareWith = input<(a: any, b: any) => boolean>(defaultCompareWith);

  // --- Presentation --------------------------------------------------------
  readonly label = input<string>('');
  readonly placeholder = input<string>('Select an option');
  readonly hint = input<string>('');
  readonly prefixIcon = input<string>('');
  readonly size = input<InputControlSize>('md');
  readonly emptyText = input<string>('No results found');
  readonly loadingText = input<string>('Loading...');
  readonly searchPlaceholder = input<string>('Search...');
  readonly panelMaxHeight = input<number>(160);

  // --- Behaviour -----------------------------------------------------------
  readonly searchable = input(false);
  readonly clearable = input(false);
  readonly required = input(false);
  readonly disabled = input(false);
  readonly errorText = input<string>('');
  /**
   * Skips built-in filtering so the parent can filter server-side off
   * `searchChange`. Options are then rendered exactly as supplied.
   */
  readonly serverSearch = input(false);

  // --- Outputs -------------------------------------------------------------
  readonly valueChange = output<any>();
  readonly selectionChange = output<T | null>();
  readonly searchChange = output<string>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  /** `<ng-template #option let-item let-selected="selected">` */
  readonly optionTemplate = contentChild<TemplateRef<any>>('option');

  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly searchRef = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly globalMessages = inject(INPUT_VALIDATION_MESSAGES);

  private readonly messages: ValidationMessageMap = {
    ...DEFAULT_VALIDATION_MESSAGES,
    ...this.globalMessages,
  };

  private readonly uid = `zc-select-${nextUniqueId++}`;
  readonly triggerId = computed(() => this.uid);
  readonly panelId = computed(() => `${this.uid}-panel`);
  readonly errorId = computed(() => `${this.uid}-error`);
  readonly hintId = computed(() => `${this.uid}-hint`);
  optionId = (index: number) => `${this.uid}-option-${index}`;

  private readonly _value = signal<any>(null);
  private readonly _cvaDisabled = signal(false);
  private readonly _touched = signal(false);
  private readonly _invalid = signal(false);
  private readonly _controlError = signal<string | null>(null);
  private readonly _hasRequiredValidator = signal(false);

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly activeIndex = signal(-1);

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    // Move focus into the panel when it opens so typing filters immediately.
    effect(() => {
      if (!this.isOpen()) return;
      queueMicrotask(() => this.searchRef()?.nativeElement.focus());
    });

    // Keep the highlighted row scrolled into view during keyboard navigation.
    effect(() => {
      const index = this.activeIndex();
      if (!this.isOpen() || index < 0) return;
      queueMicrotask(() => {
        const list = this.listRef()?.nativeElement;
        list?.querySelector<HTMLElement>(`#${CSS.escape(this.optionId(index))}`)?.scrollIntoView({
          block: 'nearest',
        });
      });
    });
  }

  ngDoCheck(): void {
    const control = this.ngControl?.control;
    if (!control) return;

    this._touched.set(control.touched);
    this._invalid.set(control.invalid);
    this._controlError.set(
      resolveValidationMessage(control.errors, this.label() || 'This field', this.messages)
    );
    this._hasRequiredValidator.set(control.hasValidator?.(Validators.required) ?? false);
  }

  // --- ControlValueAccessor ------------------------------------------------
  writeValue(value: any): void {
    this._value.set(value ?? null);
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._cvaDisabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  // --- Derived state -------------------------------------------------------
  readonly isDisabled = computed(() => this._cvaDisabled() || this.disabled());

  readonly filteredOptions = computed(() => {
    const all = this.options() ?? [];
    const query = this.searchQuery().trim().toLowerCase();
    if (!query || this.serverSearch()) return all;
    return all.filter((option) => {
      const label = String(this.labelOf(option) ?? '').toLowerCase();
      const sub = String(this.sublabelOf(option) ?? '').toLowerCase();
      return label.includes(query) || sub.includes(query);
    });
  });

  /**
   * The option matching the current control value. Resolved from the options
   * list rather than stored separately, so a value that arrives before the
   * options load (a pre-filled client code) still resolves once they land.
   */
  readonly selectedOption = computed<T | null>(() => {
    const value = this._value();
    if (value === null || value === undefined || value === '') return null;
    const compare = this.compareWith();
    return (this.options() ?? []).find((option) => compare(this.valueOf(option), value)) ?? null;
  });

  readonly triggerLabel = computed(() => {
    const option = this.selectedOption();
    if (!option) return this.placeholder();
    const label = this.labelOf(option);
    const sub = this.sublabelOf(option);
    return sub ? `${label} (${sub})` : label;
  });

  readonly showRequiredMarker = computed(() => this.required() || this._hasRequiredValidator());
  readonly errorMessage = computed(() => this.errorText() || this._controlError());
  readonly showError = computed(() => {
    if (this.errorText()) return true;
    return this._invalid() && this._touched() && !!this._controlError();
  });

  readonly canClear = computed(
    () => this.clearable() && !!this.selectedOption() && !this.isDisabled()
  );

  readonly describedBy = computed(() => {
    if (this.showError()) return this.errorId();
    if (this.hint()) return this.hintId();
    return null;
  });

  readonly triggerClasses = computed(() => {
    const sizeClass = { sm: 'py-2 text-[13px]', md: 'py-3 text-sm', lg: 'py-3.5 text-base' }[
      this.size()
    ];
    return [
      'relative w-full flex items-center justify-between gap-2 text-left cursor-pointer',
      'rounded-xl border bg-white/[0.04] text-slate-100 outline-none transition-all',
      'disabled:cursor-not-allowed',
      this.prefixIcon() ? 'pl-11' : 'pl-4',
      'pr-3',
      sizeClass,
      this.showError()
        ? 'border-red-500/70 focus:ring-2 focus:ring-red-500/20'
        : 'border-white/10 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20',
    ].join(' ');
  });

  // --- Option helpers ------------------------------------------------------
  labelOf(option: T): string {
    return readOption<T, string>(option, this.optionLabel(), '');
  }

  sublabelOf(option: T): string {
    const accessor = this.optionSublabel();
    return accessor ? readOption<T, string>(option, accessor, '') : '';
  }

  valueOf(option: T): any {
    const accessor = this.optionValue();
    return accessor ? readOption(option, accessor) : option;
  }

  isOptionDisabled(option: T): boolean {
    const accessor = this.optionDisabled();
    return accessor ? !!readOption<T, boolean>(option, accessor, false) : false;
  }

  isSelected(option: T): boolean {
    const value = this._value();
    if (value === null || value === undefined || value === '') return false;
    return this.compareWith()(this.valueOf(option), value);
  }

  trackOption(option: T, index: number): any {
    const value = this.valueOf(option);
    return value !== null && value !== undefined && typeof value !== 'object' ? value : index;
  }

  optionClasses(option: T, index: number): string {
    const active = this.activeIndex() === index;
    const selected = this.isSelected(option);
    return [
      'w-full px-3 py-2 rounded-lg text-left text-[13px] transition-all flex items-center gap-2',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      selected ? 'text-white bg-indigo-500/15' : 'text-slate-300',
      active && !selected ? 'text-white bg-white/5' : '',
      'hover:text-white hover:bg-white/5',
    ]
      .filter(Boolean)
      .join(' ');
  }

  // --- Interaction ---------------------------------------------------------
  toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen()) return;
    this.isOpen.set(true);
    this.searchQuery.set('');
    this.activeIndex.set(
      this.filteredOptions().findIndex((option) => this.isSelected(option))
    );
    this.opened.emit();
  }

  close(focusTrigger = false): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.markTouched();
    if (focusTrigger) this.triggerRef()?.nativeElement.focus();
    this.closed.emit();
  }

  select(option: T): void {
    if (this.isOptionDisabled(option)) return;
    const value = this.valueOf(option);
    this._value.set(value);
    this.onChange(value);
    this.valueChange.emit(value);
    this.selectionChange.emit(option);
    this.close(true);
  }

  clear(): void {
    this._value.set(null);
    this.onChange(null);
    this.valueChange.emit(null);
    this.selectionChange.emit(null);
    this.markTouched();
  }

  onClearClick(event: Event): void {
    // The clear affordance sits inside the trigger button; without this the
    // click would bubble up and immediately reopen the panel.
    event.stopPropagation();
    event.preventDefault();
    this.clear();
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.activeIndex.set(-1);
    this.searchChange.emit(query);
  }

  markTouched(): void {
    this._touched.set(true);
    this.onTouched();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.open();
        break;
      case 'Escape':
        this.close();
        break;
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const options = this.filteredOptions();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1, options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1, options.length);
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex.set(options.length - 1);
        break;
      case 'Enter': {
        event.preventDefault();
        const option = options[this.activeIndex()];
        if (option) this.select(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private moveActive(delta: number, length: number): void {
    if (!length) return;
    const next = (this.activeIndex() + delta + length) % length;
    this.activeIndex.set(next);
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
