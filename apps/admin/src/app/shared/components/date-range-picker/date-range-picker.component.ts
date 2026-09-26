import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { CdkTrapFocus } from '@angular/cdk/a11y';

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

interface DatePreset extends DateRange {
  readonly id: string;
  readonly label: string;
}

/** ISO `YYYY-MM-DD` in local time — `toISOString()` would shift across midnight in UTC offsets. */
const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const buildPresets = (today: Date): DatePreset[] => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const yesterday = addDays(today, -1);
  return [
    { id: 'today', label: 'Today', from: toIso(today), to: toIso(today) },
    { id: 'yesterday', label: 'Yesterday', from: toIso(yesterday), to: toIso(yesterday) },
    { id: 'week', label: 'This week', from: toIso(monday), to: toIso(today) },
    { id: 'last7', label: 'Last 7 days', from: toIso(addDays(today, -6)), to: toIso(today) },
    { id: 'month', label: 'This month', from: toIso(new Date(year, month, 1)), to: toIso(today) },
    {
      id: 'lastMonth',
      label: 'Last month',
      from: toIso(new Date(year, month - 1, 1)),
      to: toIso(new Date(year, month, 0)),
    },
  ];
};

const formatDay = (iso: string, withYear: boolean): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });

/**
 * Compact date-range filter: one trigger button opening a panel with quick
 * presets and a custom from/to range. Values are ISO `YYYY-MM-DD` strings,
 * empty string meaning "unbounded".
 */
@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateRangePickerComponent {
  public readonly from = model('');
  public readonly to = model('');
  public readonly placeholder = input('Any date');
  /** Fires after the user commits a new range (preset, apply or clear). */
  public readonly rangeChange = output<DateRange>();

  public readonly open = signal(false);
  public readonly draftFrom = signal('');
  public readonly draftTo = signal('');
  private readonly today = signal(new Date());

  public readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  public readonly presets = computed(() => buildPresets(this.today()));

  public readonly activePreset = computed(
    () =>
      this.presets().find((preset) => preset.from === this.from() && preset.to === this.to())?.id ??
      null
  );

  public readonly isSet = computed(() => !!this.from() || !!this.to());

  public readonly label = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!from && !to) return this.placeholder();
    const preset = this.presets().find((item) => item.id === this.activePreset());
    if (preset) return preset.label;
    const thisYear = String(this.today().getFullYear());
    const withYear = [from, to].some((iso) => iso && !iso.startsWith(thisYear));
    if (from && to) {
      return from === to
        ? formatDay(from, withYear)
        : `${formatDay(from, withYear)} – ${formatDay(to, withYear)}`;
    }
    return from ? `From ${formatDay(from, withYear)}` : `Until ${formatDay(to, withYear)}`;
  });

  public readonly draftInvalid = computed(
    () => !!this.draftFrom() && !!this.draftTo() && this.draftFrom() > this.draftTo()
  );

  public readonly draftChanged = computed(
    () => this.draftFrom() !== this.from() || this.draftTo() !== this.to()
  );

  public toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.today.set(new Date());
    this.draftFrom.set(this.from());
    this.draftTo.set(this.to());
    this.open.set(true);
  }

  public close(): void {
    this.open.set(false);
  }

  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  public applyPreset(preset: DatePreset): void {
    this.commit(preset.from, preset.to);
  }

  public apply(): void {
    if (this.draftInvalid()) return;
    this.commit(this.draftFrom(), this.draftTo());
  }

  public clear(): void {
    this.commit('', '');
  }

  private commit(from: string, to: string): void {
    const changed = from !== this.from() || to !== this.to();
    this.from.set(from);
    this.to.set(to);
    this.close();
    if (changed) this.rangeChange.emit({ from, to });
  }
}
