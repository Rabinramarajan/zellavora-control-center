import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface DetailTab {
  key: string;
  label: string;
  icon?: string;
}

/**
 * DetailTabsComponent — pill/underline tab bar for detail pages.
 * Two-way binds `activeKey` via the `activeKeyChange` model.
 */
@Component({
  selector: 'zcc-detail-tabs',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail-tabs.component.html',
  styleUrl: './detail-tabs.component.scss',
})
export class DetailTabsComponent {
  readonly tabs = input<DetailTab[]>([]);
  readonly activeKey = model<string>('');

  readonly activeIndex = computed(() => this.tabs().findIndex((t) => t.key === this.activeKey()));
}
