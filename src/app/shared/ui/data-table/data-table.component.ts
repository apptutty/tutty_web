import {
    Component, Input, Output, EventEmitter, TemplateRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyDopPipe } from '../../pipes/currency-dop.pipe';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { StatusBadgeComponent } from '../badge/status-badge.component';

export interface TableColumn {
    key: string;
    label: string;
    type?: 'text' | 'badge' | 'currency' | 'date' | 'boolean' | 'template';
    badgeType?: 'order' | 'booking' | 'restaurant';
    template?: TemplateRef<any>;
    sortable?: boolean;
    class?: string;
}

@Component({
    selector: 'app-data-table',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CurrencyDopPipe, TimeAgoPipe, StatusBadgeComponent],
    template: `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            @for (col of columns; track col.key) {
              <th
                class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                [class.cursor-pointer]="sortable && col.sortable !== false"
                (click)="sortable && col.sortable !== false ? onSort(col.key) : null"
              >
                <span class="flex items-center gap-1">
                  {{ col.label }}
                  @if (sortable && col.sortable !== false) {
                    <span class="text-gray-300">
                      @if (currentSort?.column === col.key) {
                        {{ currentSort?.direction === 'asc' ? '↑' : '↓' }}
                      } @else { ↕ }
                    </span>
                  }
                </span>
              </th>
            }
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          @if (loading) {
            @for (i of skeletonRows; track i) {
              <tr class="animate-pulse">
                @for (col of columns; track col.key) {
                  <td class="px-4 py-3">
                    <div class="h-4 bg-gray-200 rounded-md w-3/4"></div>
                  </td>
                }
              </tr>
            }
          } @else if (data.length === 0) {
            <tr>
              <td [colSpan]="columns.length" class="px-4 py-12 text-center">
                <div class="flex flex-col items-center gap-2 text-gray-400">
                  <span class="text-4xl">📭</span>
                  <p class="text-sm font-medium">Sin resultados</p>
                  <p class="text-xs">No se encontraron registros</p>
                </div>
              </td>
            </tr>
          } @else {
            @for (row of data; track $index) {
              <tr
                class="hover:bg-gray-50 transition-colors"
                [class.cursor-pointer]="rowClick.observed"
                (click)="rowClick.emit(row)"
              >
                @for (col of columns; track col.key) {
                  <td class="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap" [class]="col.class ?? ''">
                    @switch (col.type) {
                      @case ('badge') {
                        <app-status-badge [status]="row[col.key]" [type]="col.badgeType ?? 'order'" />
                      }
                      @case ('currency') {
                        {{ row[col.key] | currencyDop }}
                      }
                      @case ('date') {
                        {{ row[col.key] | timeAgo }}
                      }
                      @case ('boolean') {
                        <span class="inline-flex items-center gap-1 text-xs font-medium"
                          [class]="row[col.key] ? 'text-success-600' : 'text-gray-400'">
                          {{ row[col.key] ? '✓ Sí' : '✗ No' }}
                        </span>
                      }
                      @case ('template') {
                        <ng-container *ngTemplateOutlet="col.template!; context: { $implicit: row }"></ng-container>
                      }
                      @default {
                        {{ row[col.key] ?? '—' }}
                      }
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    @if (totalCount > pageSize) {
      <div class="flex items-center justify-between px-4 py-3.5 border-t border-gray-200 bg-white">
        <p class="text-sm text-gray-500">
          Mostrando {{ rangeStart }}-{{ rangeEnd }} de {{ totalCount }} resultados
        </p>
        <div class="flex items-center gap-1">
          <button
            class="btn-secondary px-2 py-1.5 text-xs"
            [disabled]="currentPage === 1"
            (click)="pageChange.emit(currentPage - 1)"
          >‹ Anterior</button>
          <span class="text-sm text-gray-600 px-2">{{ currentPage }}</span>
          <button
            class="btn-secondary px-2 py-1.5 text-xs"
            [disabled]="currentPage >= totalPages"
            (click)="pageChange.emit(currentPage + 1)"
          >Siguiente ›</button>
        </div>
      </div>
    }
  `,
})
export class DataTableComponent {
    @Input() columns: TableColumn[] = [];
    @Input() data: any[] = [];
    @Input() loading = false;
    @Input() totalCount = 0;
    @Input() pageSize = 20;
    @Input() currentPage = 1;
    @Input() sortable = true;

    @Output() pageChange = new EventEmitter<number>();
    @Output() sortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' }>();
    @Output() rowClick = new EventEmitter<any>();

    currentSort: { column: string; direction: 'asc' | 'desc' } | null = null;
    readonly skeletonRows = [1, 2, 3, 4, 5];

    get totalPages(): number { return Math.ceil(this.totalCount / this.pageSize); }
    get rangeStart(): number { return (this.currentPage - 1) * this.pageSize + 1; }
    get rangeEnd(): number { return Math.min(this.currentPage * this.pageSize, this.totalCount); }

    onSort(column: string): void {
        const direction =
            this.currentSort?.column === column && this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        this.currentSort = { column, direction };
        this.sortChange.emit({ column, direction });
    }
}
