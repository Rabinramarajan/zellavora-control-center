import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';

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
  template: `
    <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
      <table class="w-full min-w-max text-sm">
        <thead>
          <tr
            class="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 text-left"
          >
            @for (column of columns(); track column.key) {
              <th
                [style.width]="column.width"
                class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300"
              >
                <span class="inline-flex items-center gap-1">{{ column.label }}</span>
              </th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-white/5">
          @for (row of rows(); track rowKey()(row)) {
            <tr
              class="transition-colors"
              [class.cursor-pointer]="rowClickable()"
              [class.hover:bg-gray-50]="rowClickable()"
              [class.dark:hover:bg-white/5]="rowClickable()"
              (click)="rowClickable() && rowClick.emit(row)"
            >
              <ng-container
                *ngTemplateOutlet="rowTemplate() || null; context: { $implicit: row }"
              ></ng-container>
            </tr>
          } @empty {
            @if (emptyMessage()) {
              <tr>
                <td [attr.colspan]="columns().length" class="px-4 py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-gray-400">
                    <i class="pi pi-inbox text-3xl" aria-hidden="true"></i>
                    <p class="text-sm">{{ emptyMessage() }}</p>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
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
