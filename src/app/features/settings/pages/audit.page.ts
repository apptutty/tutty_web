import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuditLogEntry } from '../../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
  selector: 'app-settings-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AdminEmptyStateComponent],
  template: `
    <div>
      <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-end gap-3 mb-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Admin</label>
          <input type="text" class="input-field w-44 text-sm" [(ngModel)]="filter.admin"
            placeholder="Filtrar por admin" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" class="input-field w-40 text-sm" [(ngModel)]="filter.dateFrom" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" class="input-field w-40 text-sm" [(ngModel)]="filter.dateTo" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Acción</label>
          <input type="text" class="input-field w-44 text-sm" [(ngModel)]="filter.action"
            placeholder="Filtrar por acción" />
        </div>
        <div class="flex gap-2 sm:self-end">
          <button class="btn-primary text-sm" (click)="load()">Buscar</button>
          <button class="btn-secondary text-sm" (click)="exportCsv()">⬇ Exportar CSV</button>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admin</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acción</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tabla afectada</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor anterior</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor nuevo</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              @if (loading()) {
                @for (i of [1,2,3,4,5]; track i) {
                  <tr class="animate-pulse">
                    <td colspan="6" class="px-4 py-3">
                      <div class="h-4 bg-gray-200 rounded w-full"></div>
                    </td>
                  </tr>
                }
              } @else if (logs().length === 0) {
                <tr>
                  <td colspan="6" class="px-4 py-6">
                    <app-admin-empty-state
                      icon="search"
                      title="Sin registros de auditoría"
                      description="No hay registros para los filtros seleccionados."
                      variant="soft" />
                  </td>
                </tr>
              } @else {
                @for (log of logs(); track log.id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {{ log.created_at | date:'dd/MM/yyyy HH:mm' }}
                    </td>
                    <td class="px-4 py-3 text-gray-700 text-xs">{{ log.admin_email ?? '—' }}</td>
                    <td class="px-4 py-3 font-medium text-gray-800 text-xs">{{ log.action }}</td>
                    <td class="px-4 py-3">
                      <span class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {{ log.table_name ?? '—' }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{{ log.previous_value ?? '—' }}</td>
                    <td class="px-4 py-3 text-gray-700 text-xs max-w-xs truncate">{{ log.new_value ?? '—' }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class AuditPageComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly logs = signal<AuditLogEntry[]>([]);
  filter = { admin: '', dateFrom: '', dateTo: '', action: '' };

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    try {
      this.logs.set(await this.svc.getAuditLog(this.filter));
    } catch { } finally { this.loading.set(false); }
  }

  exportCsv() {
    const data = this.logs();
    if (!data.length) { this.toast.error('Sin datos para exportar'); return; }
    const headers = ['Fecha', 'Admin', 'Acción', 'Tabla', 'Valor anterior', 'Valor nuevo'];
    const rows = data.map(l => [
      `"${l.created_at}"`, `"${l.admin_email ?? '—'}"`, `"${l.action}"`,
      `"${l.table_name ?? '—'}"`, `"${l.previous_value ?? '—'}"`, `"${l.new_value ?? '—'}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }
}
