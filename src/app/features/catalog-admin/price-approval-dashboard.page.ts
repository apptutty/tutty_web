import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogAdminService, PendingPriceItem } from './services/catalog-admin.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

type DirectionFilter = 'all' | 'up' | 'down';
type PctFilter = 0 | 10 | 20 | 30;

@Component({
    selector: 'app-price-approval-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, PageHeaderComponent, TimeAgoPipe],
    template: `
<app-page-header title="Precios pendientes de aprobación" subtitle="Revisa y aprueba las propuestas de precio de los comercios">
  <a routerLink="/catalog" class="btn-secondary text-sm flex items-center gap-1.5">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    Catálogos
  </a>
</app-page-header>

<!-- ─── KPIs ─────────────────────────────────────────────────────────────── -->
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
  <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
    <div class="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center text-2xl flex-shrink-0">⏳</div>
    <div>
      <p class="text-xs text-gray-500 mb-0.5">Pendientes de revisión</p>
      @if (loading()) {
        <div class="h-7 w-12 bg-gray-100 rounded animate-pulse"></div>
      } @else {
        <p class="text-2xl font-bold text-warning-700">{{ allItems().length }}</p>
      }
    </div>
  </div>
  <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
    <div class="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center text-2xl flex-shrink-0">✅</div>
    <div>
      <p class="text-xs text-gray-500 mb-0.5">Aprobados esta semana</p>
      <p class="text-2xl font-bold text-success-700">{{ approvedThisWeek() }}</p>
    </div>
  </div>
  <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
    <div class="w-12 h-12 rounded-xl bg-error-100 flex items-center justify-center text-2xl flex-shrink-0">❌</div>
    <div>
      <p class="text-xs text-gray-500 mb-0.5">Rechazados esta semana</p>
      <p class="text-2xl font-bold text-error-700">{{ rejectedThisWeek() }}</p>
    </div>
  </div>
</div>

<!-- ─── Suspicious price alert ──────────────────────────────────────────── -->
@if (suspiciousCount() > 0) {
  <div class="flex items-center gap-3 p-4 mb-4 bg-orange-50 border border-orange-200 rounded-xl">
    <span class="text-2xl flex-shrink-0">⚠️</span>
    <div>
      <p class="text-sm font-semibold text-orange-800">{{ suspiciousCount() }} propuesta{{ suspiciousCount() === 1 ? '' : 's' }} supera{{ suspiciousCount() === 1 ? '' : 'n' }} el límite del {{ pctLimit() }}%</p>
      <p class="text-xs text-orange-600">Estas filas requieren notas del comercio para poder ser aprobadas</p>
    </div>
  </div>
}

<!-- ─── Batch bar ──────────────────────────────────────────────────────── -->
@if (selectedIds().size > 0) {
  <div class="flex items-center justify-between p-3 mb-4 bg-primary-50 border border-primary-200 rounded-xl">
    <span class="text-sm text-primary-700 font-medium">{{ selectedIds().size }} seleccionado{{ selectedIds().size === 1 ? '' : 's' }}</span>
    <button
      class="px-4 py-1.5 bg-success-600 hover:bg-success-700 text-white text-sm font-semibold rounded-lg transition-colors"
      (click)="batchApprove()"
      [disabled]="batchBusy()"
    >{{ batchBusy() ? 'Aprobando…' : '✅ Aprobar todos los seleccionados' }}</button>
  </div>
}

<!-- ─── Filters ────────────────────────────────────────────────────────── -->
<div class="flex flex-wrap items-center gap-3 mb-4">
  <!-- Store filter -->
  <select class="input-field text-sm w-48" [(ngModel)]="filterStore" (ngModelChange)="applyFilters()">
    <option value="">Todos los comercios</option>
    @for (store of uniqueStores(); track store.id) {
      <option [value]="store.id">{{ store.name }}</option>
    }
  </select>

  <!-- % Change filter -->
  <select class="input-field text-sm w-40" [(ngModel)]="filterPct" (ngModelChange)="applyFilters()">
    <option [ngValue]="0">Cualquier % cambio</option>
    <option [ngValue]="10">> 10%</option>
    <option [ngValue]="20">> 20%</option>
    <option [ngValue]="30">> 30%</option>
  </select>

  <!-- Direction filter -->
  <div class="flex rounded-lg border border-gray-200 overflow-hidden">
    @for (opt of directionOpts; track opt.value) {
      <button
        class="px-3 py-1.5 text-xs font-medium transition-colors"
        [class]="filterDirection === opt.value
          ? 'bg-primary-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'"
        (click)="filterDirection = opt.value; applyFilters()"
      >{{ opt.label }}</button>
    }
  </div>

  <div class="flex-1"></div>
  <p class="text-xs text-gray-400">{{ filteredItems().length }} propuestas</p>
</div>

<!-- ─── Table ──────────────────────────────────────────────────────────── -->
@if (loading()) {
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
    @for (_ of [1,2,3,4]; track $index) {
      <div class="flex items-center gap-4 px-4 py-3 border-b border-gray-100">
        <div class="w-4 h-4 bg-gray-100 rounded"></div>
        <div class="w-8 h-8 bg-gray-100 rounded-lg"></div>
        <div class="flex-1 space-y-1.5">
          <div class="h-3.5 bg-gray-100 rounded w-2/5"></div>
          <div class="h-3 bg-gray-100 rounded w-1/4"></div>
        </div>
        <div class="w-16 h-4 bg-gray-100 rounded"></div>
        <div class="w-16 h-4 bg-gray-100 rounded"></div>
        <div class="w-20 h-4 bg-gray-100 rounded"></div>
        <div class="w-32 h-7 bg-gray-100 rounded-lg"></div>
      </div>
    }
  </div>
}

@if (!loading() && filteredItems().length === 0) {
  <div class="bg-white border border-gray-200 rounded-xl p-16 text-center">
    <p class="text-5xl mb-4">🎉</p>
    <p class="text-base font-semibold text-gray-700 mb-1">¡Todo al día!</p>
    <p class="text-sm text-gray-400">No hay precios pendientes de aprobación</p>
  </div>
}

@if (!loading() && filteredItems().length > 0) {
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="w-10 px-4 py-2.5">
              <input type="checkbox" class="rounded" (change)="toggleSelectAll($event)" />
            </th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Comercio</th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Precio actual</th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Propuesto</th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Variación</th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Nota</th>
            <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Enviado</th>
            <th class="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @for (item of filteredItems(); track item.product_id) {
            <tr
              class="transition-colors hover:bg-gray-50"
              [class]="isSuspicious(item) ? 'bg-orange-50/60' : ''"
            >
              <td class="px-4 py-3 text-center">
                <input type="checkbox" class="rounded"
                       [checked]="selectedIds().has(item.product_id)"
                       (change)="toggleSelect(item.product_id, $event)" />
              </td>

              <!-- Store -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    @if (item.store_logo) {
                      <img [src]="item.store_logo" class="w-full h-full object-cover" alt="" />
                    } @else { <div class="w-full h-full flex items-center justify-center">🏪</div> }
                  </div>
                  <span class="text-xs font-medium text-gray-700 truncate max-w-[120px]">{{ item.store_name }}</span>
                </div>
              </td>

              <!-- Product -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  @if (item.product_photo) {
                    <img [src]="item.product_photo" class="w-7 h-7 rounded object-cover flex-shrink-0" alt="" />
                  }
                  <span class="text-xs text-gray-700 truncate max-w-[160px]">{{ item.product_name }}</span>
                </div>
              </td>

              <!-- Current price -->
              <td class="px-4 py-3 text-xs font-medium text-gray-700">
                RD\${{ item.current_price | number:'1.0-0' }}
              </td>

              <!-- Proposed price -->
              <td class="px-4 py-3 text-xs font-bold text-gray-800">
                RD\${{ item.pending_price | number:'1.0-0' }}
              </td>

              <!-- Variation -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <span class="px-2 py-0.5 rounded-full text-xs font-bold"
                        [class]="item.price_change_pct > 0
                          ? 'bg-error-100 text-error-700'
                          : 'bg-success-100 text-success-700'">
                    {{ item.price_change_pct > 0 ? '▲' : '▼' }} {{ item.price_change_pct | number:'1.0-0' }}%
                  </span>
                  @if (isSuspicious(item)) {
                    <span class="text-orange-500" title="Supera el límite del {{ pctLimit() }}%">⚠️</span>
                  }
                </div>
              </td>

              <!-- Note -->
              <td class="px-4 py-3 max-w-[160px]">
                @if (item.pending_notes) {
                  <p class="text-[11px] text-gray-500 truncate" [title]="item.pending_notes">{{ item.pending_notes }}</p>
                } @else {
                  <span class="text-gray-300 text-xs">—</span>
                }
              </td>

              <!-- Submitted -->
              <td class="px-4 py-3 text-[11px] text-gray-400">
                {{ item.submitted_at | timeAgo }}
              </td>

              <!-- Actions -->
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <!-- Approve -->
                  <button
                    class="px-2 py-1 bg-success-50 hover:bg-success-100 text-success-700 text-xs font-semibold rounded-lg transition-colors"
                    (click)="quickApprove(item)"
                    [disabled]="approving() === item.product_id || (isSuspicious(item) && !item.pending_notes)"
                    [title]="isSuspicious(item) && !item.pending_notes ? 'Requiere nota del comercio' : 'Aprobar precio'"
                  >✅</button>

                  <!-- Reject -->
                  <button
                    class="px-2 py-1 bg-error-50 hover:bg-error-100 text-error-700 text-xs font-semibold rounded-lg transition-colors"
                    (click)="openReject(item)"
                  >❌</button>

                  <!-- Ask clarification -->
                  <button
                    class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors"
                    title="Pedir aclaración"
                    (click)="askClarification(item)"
                  >💬</button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>
}

<!-- ─── Reject modal ────────────────────────────────────────────────────── -->
@if (rejectingItem()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" (click)="rejectingItem.set(null)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
      <h3 class="text-base font-bold text-gray-800 mb-1">Rechazar propuesta</h3>
      <div class="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div class="p-2.5 bg-gray-50 rounded-lg text-center">
          <p class="text-xs text-gray-400 mb-1">Actual</p>
          <p class="font-bold">RD\${{ rejectingItem()!.current_price | number:'1.0-0' }}</p>
        </div>
        <div class="p-2.5 bg-warning-50 rounded-lg text-center">
          <p class="text-xs text-warning-600 mb-1">Propuesto</p>
          <p class="font-bold text-warning-700">RD\${{ rejectingItem()!.pending_price | number:'1.0-0' }}</p>
        </div>
      </div>
      <label class="label text-xs mb-1 block">Motivo del rechazo *</label>
      <textarea class="input-field text-sm resize-none w-full" rows="3"
                [(ngModel)]="rejectReason"
                placeholder="Explica por qué se rechaza esta propuesta…"></textarea>
      <div class="flex gap-3 justify-end mt-4">
        <button class="btn-secondary text-sm" (click)="rejectingItem.set(null)">Cancelar</button>
        <button
          class="px-4 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-semibold rounded-xl transition-colors"
          (click)="confirmReject()"
          [disabled]="!rejectReason.trim() || rejecting()"
        >{{ rejecting() ? 'Rechazando…' : 'Rechazar precio' }}</button>
      </div>
    </div>
  </div>
}
    `,
})
export class PriceApprovalDashboardComponent implements OnInit {
    private readonly svc = inject(CatalogAdminService);
    private readonly toast = inject(ToastService);

    readonly allItems = signal<PendingPriceItem[]>([]);
    readonly loading = signal(true);
    readonly approving = signal<string | null>(null);
    readonly batchBusy = signal(false);
    readonly rejecting = signal(false);
    readonly rejectingItem = signal<PendingPriceItem | null>(null);
    readonly selectedIds = signal<Set<string>>(new Set());

    readonly approvedThisWeek = signal(0);
    readonly rejectedThisWeek = signal(0);

    // Filters
    filterStore = '';
    filterPct: PctFilter = 0;
    filterDirection: DirectionFilter = 'all';

    readonly filteredItems = signal<PendingPriceItem[]>([]);

    readonly pctLimit = signal(20);

    readonly directionOpts: { value: DirectionFilter; label: string }[] = [
        { value: 'all', label: 'Todos' },
        { value: 'up', label: '▲ Subidas' },
        { value: 'down', label: '▼ Bajadas' },
    ];

    readonly uniqueStores = computed(() => {
        const map = new Map<string, { id: string; name: string }>();
        for (const item of this.allItems()) {
            if (!map.has(item.store_id)) map.set(item.store_id, { id: item.store_id, name: item.store_name });
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    });

    readonly suspiciousCount = computed(() =>
        this.filteredItems().filter(i => this.isSuspicious(i)).length
    );

    rejectReason = '';

    ngOnInit(): void {
        this.load();
        this.svc.getWeeklyPriceStats().subscribe(stats => {
            this.approvedThisWeek.set(stats.approved);
            this.rejectedThisWeek.set(stats.rejected);
        });
        this.svc.getAppSetting('max_price_increase_pct').subscribe(val => {
            const parsed = parseInt(val ?? '', 10);
            if (!isNaN(parsed)) this.pctLimit.set(parsed);
        });
    }

    private load(): void {
        this.loading.set(true);
        this.svc.getPendingPriceApprovals().subscribe({
            next: items => {
                this.allItems.set(items);
                this.applyFilters();
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }

    applyFilters(): void {
        let items = this.allItems();
        if (this.filterStore) items = items.filter(i => i.store_id === this.filterStore);
        if (this.filterPct > 0) items = items.filter(i => Math.abs(i.price_change_pct) > this.filterPct);
        if (this.filterDirection === 'up') items = items.filter(i => i.price_change_pct > 0);
        if (this.filterDirection === 'down') items = items.filter(i => i.price_change_pct < 0);
        this.filteredItems.set(items);
        this.selectedIds.set(new Set());
    }

    isSuspicious(item: PendingPriceItem): boolean {
        // Only flag upward price changes that exceed the limit
        return item.price_change_pct > this.pctLimit();
    }

    // ─── Selection ────────────────────────────────────────────────────────────

    toggleSelect(id: string, event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.selectedIds.update(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }

    toggleSelectAll(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.selectedIds.set(checked ? new Set(this.filteredItems().map(i => i.product_id)) : new Set());
    }

    // ─── Approve ─────────────────────────────────────────────────────────────

    async quickApprove(item: PendingPriceItem): Promise<void> {
        this.approving.set(item.product_id);
        try {
            await this.svc.approvePendingPrice(item.product_id);
            this.allItems.update(prev => prev.filter(i => i.product_id !== item.product_id));
            this.applyFilters();
            this.approvedThisWeek.update(n => n + 1);
            this.toast.success(`✅ Precio aprobado — ${item.product_name}`);
        } catch {
            this.toast.error('Error al aprobar');
        } finally {
            this.approving.set(null);
        }
    }

    async batchApprove(): Promise<void> {
        const ids = [...this.selectedIds()];
        if (!ids.length) return;
        this.batchBusy.set(true);
        try {
            await Promise.all(ids.map(id => this.svc.approvePendingPrice(id)));
            this.allItems.update(prev => prev.filter(i => !ids.includes(i.product_id)));
            this.applyFilters();
            this.approvedThisWeek.update(n => n + ids.length);
            this.toast.success(`✅ ${ids.length} precios aprobados`);
        } catch {
            this.toast.error('Error en la aprobación masiva');
        } finally {
            this.batchBusy.set(false);
        }
    }

    // ─── Reject ───────────────────────────────────────────────────────────────

    openReject(item: PendingPriceItem): void {
        this.rejectingItem.set(item);
        this.rejectReason = '';
    }

    async confirmReject(): Promise<void> {
        const item = this.rejectingItem();
        if (!item || !this.rejectReason.trim()) return;
        this.rejecting.set(true);
        try {
            await this.svc.rejectPendingPrice(item.product_id, this.rejectReason.trim());
            this.allItems.update(prev => prev.filter(i => i.product_id !== item.product_id));
            this.applyFilters();
            this.rejectedThisWeek.update(n => n + 1);
            this.toast.success('Precio rechazado');
            this.rejectingItem.set(null);
        } catch {
            this.toast.error('Error al rechazar');
        } finally {
            this.rejecting.set(false);
        }
    }

    // ─── Ask clarification ────────────────────────────────────────────────────

    async askClarification(item: PendingPriceItem): Promise<void> {
        try {
            await this.svc.sendStoreNotification(
                item.store_id,
                'Aclaración solicitada sobre propuesta de precio',
                `Por favor provee más detalles sobre la propuesta de precio para "${item.product_name}" (RD\$${item.pending_price}).`,
                { product_id: item.product_id }
            );
            this.toast.info('💬 Aclaración solicitada al comercio');
        } catch {
            this.toast.error('Error al enviar la solicitud');
        }
    }
}
