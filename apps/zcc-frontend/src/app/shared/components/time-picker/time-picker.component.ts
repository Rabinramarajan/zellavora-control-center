import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { TimeFormat, formatTime, parseTime, timeSlots } from './time-picker.utils';

let nextId = 0;

/**
 * Time-of-day field: type freely ("930p", "21:30") or pick from a list.
 *
 *   <app-time-picker [(ngModel)]="start" placeholder="9:00 AM" />
 *
 * The value is a display string ("10:00 AM", or "10:00" with format="24h"),
 * or null when cleared. Typed text is normalised when the field loses focus
 * or Enter is pressed; unreadable text reverts to the last good value.
 * Works with ngModel and reactive forms.
 */
@Component({
  selector: 'app-time-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
  host: {
    '[class.tp-disabled]': 'isDisabled()',
    '[class.tp-open]': 'open()',
  },
})
export class TimePickerComponent implements ControlValueAccessor {
  public readonly format = input<TimeFormat>('12h');
  /** Minutes between options in the list. Any time can still be typed. */
  public readonly step = input(15);
  public readonly placeholder = input('');
  public readonly ariaLabel = input<string | null>(null);
  public readonly inputId = input(`app-time-picker-${nextId++}`);
  /** Disables the field without a form control, e.g. on a read-only row. */
  public readonly disabled = input(false);

  /** Fires on every committed change, alongside the form control. */
  public readonly valueChange = output<string | null>();

  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly listId = computed(() => `${this.inputId()}-list`);

  private readonly formDisabled = signal(false);
  private readonly committed = signal<number | null>(null);
  private readonly listbox = viewChild<ElementRef<HTMLElement>>('listbox');

  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly options = computed(() =>
    timeSlots(this.step()).map((minutes) => ({
      minutes,
      label: formatTime(minutes, this.format()),
    }))
  );

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  public writeValue(value: string | null): void {
    const minutes = parseTime(value);
    this.committed.set(minutes);
    this.text.set(minutes === null ? '' : formatTime(minutes, this.format()));
  }

  public registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
    if (isDisabled) this.open.set(false);
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    const typed = parseTime(this.text());
    if (typed !== null && this.open()) this.highlight(this.nearestIndex(typed));
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.open()) {
      this.open.set(false);
    } else {
      this.openList();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.openList();
          return;
        }
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        this.highlight((this.activeIndex() + delta + count) % count);
        return;
      }
      case 'Enter':
        if (this.open() && this.activeIndex() >= 0) {
          event.preventDefault();
          this.select(this.options()[this.activeIndex()].minutes);
        } else {
          this.commitText();
        }
        return;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.open.set(false);
        }
        return;
      case 'Tab':
        this.open.set(false);
        return;
    }
  }

  protected onBlur(): void {
    // Picking with the mouse blurs the input first; that click commits the value itself.
    if (!this.open()) this.commitText();
    this.onTouched();
  }

  protected select(minutes: number): void {
    this.open.set(false);
    this.commit(minutes);
  }

  protected optionId(index: number): string {
    return `${this.listId()}-${index}`;
  }

  protected clear(): void {
    this.commit(null);
  }

  private openList(): void {
    const current = parseTime(this.text()) ?? this.committed() ?? 9 * 60;
    this.open.set(true);
    this.highlight(this.nearestIndex(current));
  }

  private commitText(): void {
    const text = this.text().trim();
    if (!text) {
      this.commit(null);
      return;
    }
    const minutes = parseTime(text);
    if (minutes === null) {
      // Unreadable input never reaches the form; show the last good value again.
      const last = this.committed();
      this.text.set(last === null ? '' : formatTime(last, this.format()));
      return;
    }
    this.commit(minutes);
  }

  private commit(minutes: number | null): void {
    const value = minutes === null ? null : formatTime(minutes, this.format());
    this.text.set(value ?? '');
    if (minutes === this.committed()) return;
    this.committed.set(minutes);
    this.onChange(value);
    this.valueChange.emit(value);
  }

  private nearestIndex(minutes: number): number {
    const options = this.options();
    let best = 0;
    options.forEach((option, index) => {
      if (Math.abs(option.minutes - minutes) < Math.abs(options[best].minutes - minutes)) {
        best = index;
      }
    });
    return best;
  }

  private highlight(index: number): void {
    this.activeIndex.set(index);
    // Wait for the overlay to render before scrolling the option into view.
    queueMicrotask(() =>
      this.listbox()
        ?.nativeElement.querySelector(`#${CSS.escape(this.optionId(index))}`)
        ?.scrollIntoView({ block: 'nearest' })
    );
  }
}
