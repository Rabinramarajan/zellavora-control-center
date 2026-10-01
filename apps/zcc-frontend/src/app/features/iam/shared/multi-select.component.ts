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
import { IAM_INPUT } from './iam-page-header.component';

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
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
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
