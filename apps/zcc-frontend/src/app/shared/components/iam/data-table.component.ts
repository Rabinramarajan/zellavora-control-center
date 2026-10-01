import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, input, output } from '@angular/core';

/** Minimal column contract for the shared data table. */
export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

/**
 * DataTableComponent — generic table with a consumer-supplied row template.
 *
 *   <zcc-data-table [columns]="cols" [rows]="store.items()" [rowTemplate]="rowTpl"
 *                   (rowClick)="open($event)">
 *     <ng-template #rowTpl let-row>
 *       <td class="px-4 py-3">{{ row.name }}</td>
 *       <td class="px-4 py-3"><zcc-status-chip [value]="row.status" /></td>
 *     </ng-template>
 *   </zcc-data-table>
 *
 * The column count is implied by the template's `<td>` count. Rows must equal
 * the column width so headers line up — keep both aligned.
 */
@Component({
  selector: 'zcc-data-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T> {
  readonly columns = input<DataTableColumn[]>([]);
  readonly rows = input<T[]>([]);
  readonly rowTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  readonly rowKey = input<(row: T) => string>((row) => (row as { id?: string }).id ?? '');
  readonly rowClickable = input(false);
  readonly emptyMessage = input('');
  readonly rowClick = output<T>();
}
