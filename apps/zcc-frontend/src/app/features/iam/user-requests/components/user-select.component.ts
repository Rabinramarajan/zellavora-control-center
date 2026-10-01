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
import { IamApiService } from '../../../../core/api/iam.api';
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
  templateUrl: './user-select.component.html',
  styleUrl: './user-select.component.scss',
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
