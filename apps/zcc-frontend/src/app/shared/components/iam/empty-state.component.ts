import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * EmptyStateComponent — centered icon + heading for list/panel empty states.
 */
@Component({
  selector: 'zcc-empty-state',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly icon = input('pi pi-inbox');
  readonly title = input.required<string>();
  readonly message = input('');
}
