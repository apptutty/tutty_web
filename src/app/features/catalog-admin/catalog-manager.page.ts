import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
    CatalogAdminService, StoreWithCatalogStats, PendingPriceItem, CatalogStoreFilters,
} from './services/catalog-admin.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

const COMMERCE_ICONS: Record<string, string> = {
    restaurante: '🍽️', farmacia: '💊', bodega: '📦',
    colmado: '🛒', tienda_ropa: '👗', supermercado: '🛒',
    electronica: '📱', otro: '🏪',
};

const COMMERCE_LABELS: Record<string, string> = {
    restaurante: 'Restaurante', farmacia: 'Farmacia', bodega: 'Bodega',
    colmado: 'Colmado', tienda_ropa: 'Ropa', supermercado: 'Supermercado',
    electronica: 'Electrónica', otro: 'Otro',
};

const COMMERCE_TYPES = [
    { value: '', label: 'Todos los tipos' },
    { value: 'restaurante', label: 'Restaurantes' },
    { value: 'farmacia', label: 'Farmacias' },
    { value: 'bodega', label: 'Bodegas' },
    { value: 'colmado', label: 'Colmados' },
    { value: 'tienda_ropa', label: 'Tiendas de ropa' },
    { value: 'supermercado', label: 'Supermercados' },
    { value: 'electronica', label: 'Electrónica' },
    { value: 'otro', label: 'Otros' },
];

@Component({
    selector: 'app-catalog-manager',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, TimeAgoPipe],
    template: `
<app-page-header title="Gestión de Catálogos" subtitle="Administra el catálogo de todos los comercios en la plataforma">
  <a routerLink="/catalog/search"
     class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors font-medium">
    🔍 Buscar producto
  </a>
  <a routerLink="/catalog/price-approvals"
     class="flex items-center gap-1.5 px-3 py-1.5 bg-warning-50 border border-warning-300 rounded-lg text-sm text-warning-700 hover:bg-warning-100 transition-colors font-medium">
    💰
    Precios pendientes
    @if (totalPending() > 0) {
      <span class="ml-1 px-1.5 py-0.5 bg-warning-500 text-white text-xs rounded-full font-bold">{{ totalPending() }}</span>
    }
  </a>
</app-page-header>

<!-- ─── Pending price alert banner ──────────────────────────────────────── -->
@if (totalPending() > 0 && !filterPendingPrices) {
  <div class="flex items-center justify-between p-4 mb-4 bg-warning-50 border border-warning-200 rounded-xl">
    <div class="flex items-center gap-3">
      <span class="text-xl">⚠️</span>
      <div>
        <p class="text-sm font-semibold text-warning-800">
          {{ totalPending() }} producto{{ totalPending() === 1 ? '' : 's' }} con precio{{ totalPending() === 1 ? '' : 's' }} pendiente{{ totalPending() === 1 ? '' : 's' }} de aprobación
        </p>
        <p class="text-xs text-warning-600">Requiere revisión antes de publicarse a los clientes</p>
      </div>
    </div>
    <button
      class="px-3 py-1.5 bg-warning-500 hover:bg-warning-600 text-white text-sm font-semibold rounded-lg transition-colors"
      (click)="filterPendingPrices = true; load()"
    >
      Revisar ahora
    </button>
  </div>
}

<!-- ─── Pending prices widget ─────────────────────────────────────────────── -->
@if (pendingItems().length > 0) {
  <div class="bg-white border border-warning-200 rounded-xl mb-6 overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 bg-warning-50 border-b border-warning-200">
      <h3 class="text-sm font-bold text-warning-800 flex items-center gap-2">
        💰 Precios pendientes de aprobación
        <span class="px-2 py-0.5 bg-warning-500 text-white text-xs rounded-full font-bold">{{ pendingItems().length }}</span>
      </h3>
      <a routerLink="/catalog/price-approvals" class="text-xs text-warning-700 hover:underline font-medium">Ver todos →</a>
    </div>

    <div class="divide-y divide-gray-100">
      @for (item of pendingItems().slice(0, 5); track item.product_id) {
        <div class="flex items-center gap-3 px-4 py-3">
          <!-- Store -->
          <div class="flex items-center gap-2 w-36 flex-shrink-0">
            @if (item.store_logo) {
              <img [src]="item.store_logo" class="w-7 h-7 rounded-lg object-cover flex-shrink-0" alt="" />
            } @else {
              <div class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">🏪</div>
            }
            <span class="text-xs font-medium text-gray-700 truncate">{{ item.store_name }}</span>
          </div>
          <!-- Product -->
          <div class="flex items-center gap-2 flex-1 min-w-0">
            @if (item.product_photo) {
              <img [src]="item.product_photo" class="w-7 h-7 rounded object-cover flex-shrink-0" alt="" />
            }
            <span class="text-xs text-gray-700 truncate">{{ item.product_name }}</span>
          </div>
          <!-- Prices -->
          <div class="flex items-center gap-2 text-xs flex-shrink-0">
            <span class="text-gray-500">RD\${{ item.current_price | number:'1.0-0' }}</span>
            <span class="text-gray-400">→</span>
            <span class="font-semibold text-gray-800">RD\${{ item.pending_price | number:'1.0-0' }}</span>
            <span class="px-1.5 py-0.5 rounded-full font-bold text-[10px]"
                  [class]="item.price_change_pct > 0
                    ? (item.price_change_pct > 20 ? 'bg-error-100 text-error-700' : 'bg-orange-100 text-orange-700')
                    : 'bg-success-100 text-success-700'">
              {{ item.price_change_pct > 0 ? '+' : '' }}{{ item.price_change_pct }}%
            </span>
            @if (item.price_change_pct > 20) {
              <span title="Supera el límite habitual del 20%">⚠️</span>
            }
          </div>
          <!-- Actions -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="px-2 py-1 bg-success-50 hover:bg-success-100 text-success-700 text-xs font-semibold rounded-lg transition-colors"
              (click)="quickApprove(item)"
              [disabled]="approving() === item.product_id"
            >✅ Aprobar</button>
            <button
              class="px-2 py-1 bg-error-50 hover:bg-error-100 text-error-700 text-xs font-semibold rounded-lg transition-colors"
              (click)="openRejectModal(item)"
            >❌ Rechazar</button>
          </div>
        </div>
      }
    </div>
  </div>
}

<!-- ─── Toolbar ───────────────────────────────────────────────────────────── -->
<div class="flex flex-wrap items-center gap-3 mb-5">
  <!-- Search -->
  <div class="relative flex-1 min-w-[200px] max-w-sm">
    <svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
         fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
    </svg>
    <input
      type="search"
      class="input-field pl-8 text-sm"
      placeholder="Buscar comercio…"
      [(ngModel)]="searchQuery"
      (ngModelChange)="onSearch()"
    />
  </div>

  <!-- Commerce type -->
  <select class="input-field text-sm w-44" [(ngModel)]="filterType" (ngModelChange)="load()">
    @for (ct of commerceTypes; track ct.value) {
      <option [value]="ct.value">{{ ct.label }}</option>
    }
  </select>

  <!-- Pending prices toggle -->
  <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
    <div class="relative">
      <input type="checkbox" class="sr-only" [(ngModel)]="filterPendingPrices" (ngModelChange)="load()" />
      <div class="w-9 h-5 rounded-full transition-colors" [class]="filterPendingPrices ? 'bg-warning-500' : 'bg-gray-300'"></div>
      <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
           [style.transform]="filterPendingPrices ? 'translateX(16px)' : 'translateX(0)'"></div>
    </div>
    <span class="text-warning-700 font-medium">Solo precios pendientes</span>
  </label>

  <!-- Out of stock toggle -->
  <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
    <div class="relative">
      <input type="checkbox" class="sr-only" [(ngModel)]="filterOutOfStock" (ngModelChange)="load()" />
      <div class="w-9 h-5 rounded-full transition-colors" [class]="filterOutOfStock ? 'bg-error-500' : 'bg-gray-300'"></div>
      <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
           [style.transform]="filterOutOfStock ? 'translateX(16px)' : 'translateX(0)'"></div>
    </div>
    <span class="text-error-700 font-medium">Solo con agotados</span>
  </label>

  <div class="flex-1"></div>
  <p class="text-xs text-gray-400">{{ stores().length }} comercios</p>
</div>

<!-- ─── Loading ───────────────────────────────────────────────────────────── -->
@if (loading()) {
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    @for (_ of [1,2,3,4,5,6]; track $index) {
      <div class="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gray-100"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-100 rounded w-2/3"></div>
            <div class="h-3 bg-gray-100 rounded w-1/3"></div>
          </div>
        </div>
        <div class="space-y-2 border-t border-gray-100 pt-3">
          <div class="h-3 bg-gray-100 rounded w-3/4"></div>
          <div class="h-3 bg-gray-100 rounded w-1/2"></div>
          <div class="h-3 bg-gray-100 rounded w-2/3"></div>
        </div>
        <div class="mt-4 h-8 bg-gray-100 rounded-lg"></div>
      </div>
    }
  </div>
}

<!-- ─── Store grid ─────────────────────────────────────────────────────────── -->
@if (!loading() && stores().length === 0) {
  <div class="flex flex-col items-center justify-center py-24 text-gray-400">
    <span class="text-5xl mb-4">📦</span>
    <p class="text-base font-medium text-gray-500">Sin comercios para estos filtros</p>
  </div>
}

@if (!loading() && stores().length > 0) {
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    @for (store of stores(); track store.id) {
      <div
        class="bg-white rounded-xl border flex flex-col overflow-hidden transition-shadow hover:shadow-md"
        [class]="store.pending_price_approval > 0
          ? 'border-warning-300 shadow-warning-100 shadow-sm'
          : 'border-gray-200'"
      >
        <!-- Pulsing top border for pending prices -->
        @if (store.pending_price_approval > 0) {
          <div class="h-1 bg-warning-400 animate-pulse"></div>
        }

        <div class="p-4 flex-1">
          <!-- Header: logo + name + badge -->
          <div class="flex items-start gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center text-xl">
              @if (store.logo_url) {
                <img [src]="store.logo_url" class="w-full h-full object-cover" alt="" />
              } @else {
                {{ commerceIcon(store.commerce_type) }}
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-gray-800 truncate">{{ store.name }}</p>
              <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {{ commerceLabel(store.commerce_type) }}
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      [class]="store.is_open ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'">
                  {{ store.is_open ? 'Abierto' : 'Cerrado' }}
                </span>
                @if (!store.is_active) {
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-error-100 text-error-700 font-medium">Inactivo</span>
                }
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="border-t border-gray-100 pt-3 space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">📦 Productos activos</span>
              <span class="font-semibold text-gray-700">{{ store.active_products }} / {{ store.total_products }}</span>
            </div>

            @if (store.pending_price_approval > 0) {
              <div class="flex items-center justify-between text-xs">
                <span class="text-warning-600 font-medium">⚠️ Precios pendientes</span>
                <span class="font-bold text-warning-700">{{ store.pending_price_approval }}</span>
              </div>
            }

            @if (store.out_of_stock > 0) {
              <div class="flex items-center justify-between text-xs">
                <span class="text-error-600">🔴 Agotados</span>
                <span class="font-bold text-error-700">{{ store.out_of_stock }}</span>
              </div>
            }

            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">🗂️ Categorías</span>
              <span class="font-semibold text-gray-700">{{ store.categories_count }}</span>
            </div>

            <div class="text-[10px] text-gray-400 pt-0.5">
              Actualizado {{ store.last_catalog_update | timeAgo }}
            </div>
          </div>
        </div>

        <!-- Footer action -->
        <div class="px-4 pb-4">
          <a
            [routerLink]="['/catalog', store.id]"
            class="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Gestionar catálogo
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    }
  </div>
}

<!-- ─── Reject modal ─────────────────────────────────────────────────────── -->
@if (rejectingItem()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" (click)="rejectingItem.set(null)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
      <h3 class="text-base font-bold text-gray-800 mb-1">Rechazar propuesta de precio</h3>
      <p class="text-sm text-gray-500 mb-4">
        Producto: <strong>{{ rejectingItem()!.product_name }}</strong><br>
        Precio propuesto: <strong>RD\${{ rejectingItem()!.pending_price | number:'1.0-0' }}</strong>
      </p>
      <label class="label text-xs mb-1 block">Motivo del rechazo *</label>
      <textarea class="input-field text-sm resize-none w-full" rows="3"
                [(ngModel)]="rejectReason"
                placeholder="Explica al comercio por qué se rechaza el precio…"></textarea>
      <div class="flex gap-3 justify-end mt-4">
        <button class="btn-secondary text-sm" (click)="rejectingItem.set(null)">Cancelar</button>
        <button
          class="btn-primary text-sm bg-error-600 hover:bg-error-700"
          (click)="confirmReject()"
          [disabled]="!rejectReason.trim() || rejecting()"
        >
          {{ rejecting() ? 'Rechazando…' : 'Rechazar precio' }}
        </button>
      </div>
    </div>
  </div>
}
    `,
})
export class CatalogManagerPageComponent implements OnInit {
    private readonly svc = inject(CatalogAdminService);
    private readonly toast = inject(ToastService);
    private readonly router = inject(Router);

    readonly stores = signal<StoreWithCatalogStats[]>([]);
    readonly pendingItems = signal<PendingPriceItem[]>([]);
    readonly loading = signal(true);
    readonly approving = signal<string | null>(null);
    readonly rejecting = signal(false);
    readonly rejectingItem = signal<PendingPriceItem | null>(null);

    readonly totalPending = computed(() => this.pendingItems().length);

    // ── Filters ───────────────────────────────────────────────────────────────

    searchQuery = '';
    filterType = '';
    filterPendingPrices = false;
    filterOutOfStock = false;

    readonly commerceTypes = COMMERCE_TYPES;

    private searchTimeout: ReturnType<typeof setTimeout> | null = null;
    rejectReason = '';

    ngOnInit(): void {
        this.load();
        this.loadPending();
    }

    load(): void {
        this.loading.set(true);
        const filters: CatalogStoreFilters = {
            commerce_type: this.filterType || undefined,
            has_pending_prices: this.filterPendingPrices || undefined,
            has_out_of_stock: this.filterOutOfStock || undefined,
            search: this.searchQuery || undefined,
        };
        this.svc.getStoresWithCatalogStats(filters).subscribe({
            next: s => {
                this.stores.set(s);
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }

    private loadPending(): void {
        this.svc.getPendingPriceApprovals().subscribe({ next: items => this.pendingItems.set(items) });
    }

    onSearch(): void {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.load(), 300);
    }

    commerceIcon(type: string): string { return COMMERCE_ICONS[type] ?? '🏪'; }
    commerceLabel(type: string): string { return COMMERCE_LABELS[type] ?? type; }

    async quickApprove(item: PendingPriceItem): Promise<void> {
        this.approving.set(item.product_id);
        try {
            await this.svc.approvePendingPrice(item.product_id);
            this.pendingItems.update(prev => prev.filter(p => p.product_id !== item.product_id));
            this.toast.success(`✅ Precio aprobado para "${item.product_name}"`);
            this.load();
        } catch {
            this.toast.error('Error al aprobar el precio');
        } finally {
            this.approving.set(null);
        }
    }

    openRejectModal(item: PendingPriceItem): void {
        this.rejectingItem.set(item);
        this.rejectReason = '';
    }

    async confirmReject(): Promise<void> {
        const item = this.rejectingItem();
        if (!item || !this.rejectReason.trim()) return;
        this.rejecting.set(true);
        try {
            await this.svc.rejectPendingPrice(item.product_id, this.rejectReason.trim());
            this.pendingItems.update(prev => prev.filter(p => p.product_id !== item.product_id));
            this.toast.success(`❌ Precio rechazado para "${item.product_name}"`);
            this.rejectingItem.set(null);
            this.load();
        } catch {
            this.toast.error('Error al rechazar el precio');
        } finally {
            this.rejecting.set(false);
        }
    }
}
