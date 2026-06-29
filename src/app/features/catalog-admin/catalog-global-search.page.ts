import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
    CatalogAdminService, GlobalSearchFilters, GlobalSearchResult, CatalogAnomalies, ModerationStatus,
} from './services/catalog-admin.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

const COMMERCE_TYPES = [
    { value: '', label: 'Todos los tipos' },
    { value: 'restaurante', label: 'Restaurantes' },
    { value: 'farmacia', label: 'Farmacias' },
    { value: 'bodega', label: 'Bodegas' },
    { value: 'colmado', label: 'Colmados' },
    { value: 'tienda_ropa', label: 'Tiendas de ropa' },
    { value: 'supermercado', label: 'Supermercados' },
    { value: 'electronica', label: 'Electrónica' },
];

const DIETARY_TAGS = [
    { key: 'vegetariano', label: '🌿 Vegetariano' },
    { key: 'vegano', label: '🌱 Vegano' },
    { key: 'sin_gluten', label: '🌾 Sin gluten' },
    { key: 'sin_lactosa', label: '🥛 Sin lactosa' },
    { key: 'celiaco', label: '⚕️ Celíaco' },
    { key: 'bajo_sodio', label: '🧂 Bajo en sodio' },
    { key: 'apto_diabetico', label: '💉 Apto diabético' },
    { key: 'halal', label: '☪️ Halal' },
    { key: 'kosher', label: '✡️ Kosher' },
];

const MOD_OPTIONS: { value: ModerationStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Cualquier estado' },
    { value: 'aprobado', label: '✅ Aprobado' },
    { value: 'bajo_revision', label: '⚠️ Bajo revisión' },
    { value: 'retirado', label: '🔴 Retirado' },
];

const STOCK_STATUS_LABELS: Record<string, string> = {
    disponible: '✅',
    bajo_stock: '⚠️',
    agotado: '🔴',
    no_controlado: '—',
};

const MOD_LABELS: Record<string, string> = {
    aprobado: '✅ Aprobado',
    bajo_revision: '⚠️ Revisión',
    retirado: '🔴 Retirado',
};

const MOD_CLASSES: Partial<Record<string, string>> = {
    aprobado: 'bg-success-100 text-success-700',
    bajo_revision: 'bg-warning-100 text-warning-700',
    retirado: 'bg-error-100 text-error-700',
};

@Component({
    selector: 'app-catalog-global-search',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, PageHeaderComponent, AdminEmptyStateComponent],
    template: `
<app-page-header title="Búsqueda global de productos" subtitle="Busca en el catálogo completo de todos los comercios">
  <a routerLink="/catalog" class="btn-secondary text-sm flex items-center gap-1.5">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    Catálogos
  </a>
</app-page-header>

<!-- ─── Search bar ──────────────────────────────────────────────────────────── -->
<div class="relative mb-4">
  <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
       fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
  </svg>
  <input
    type="search"
    class="input-field pl-10 text-base py-3"
    placeholder="Buscar por nombre, descripción, marca, SKU, código de barras…"
    [ngModel]="searchQuery"
    (ngModelChange)="onQueryChange($event)"
    [disabled]="loading()"
  />
  @if (loading()) {
    <div class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
  }
</div>

<!-- ─── Advanced filters ─────────────────────────────────────────────────────── -->
<div class="bg-white border border-gray-200 rounded-xl p-4 mb-5">
  <div class="flex flex-wrap gap-4 items-end">

    <!-- Commerce type -->
    <div>
      <label class="block text-xs text-gray-500 mb-1">Tipo de comercio</label>
      <select class="input-field text-sm w-44" [(ngModel)]="filterType" (ngModelChange)="triggerSearch()">
        @for (ct of commerceTypes; track ct.value) {
          <option [value]="ct.value">{{ ct.label }}</option>
        }
      </select>
    </div>

    <!-- Price range -->
    <div class="flex items-center gap-2">
      <div>
        <label class="block text-xs text-gray-500 mb-1">Precio mín (RD\$)</label>
        <input type="number" class="input-field text-sm w-28" [(ngModel)]="filterMinPrice"
               (change)="triggerSearch()" min="0" max="50000" placeholder="0" />
      </div>
      <span class="text-gray-400 text-sm mt-4">—</span>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Precio máx (RD\$)</label>
        <input type="number" class="input-field text-sm w-28" [(ngModel)]="filterMaxPrice"
               (change)="triggerSearch()" min="0" max="50000" placeholder="50,000" />
      </div>
    </div>

    <!-- Moderation status -->
    <div>
      <label class="block text-xs text-gray-500 mb-1">Moderación</label>
      <select class="input-field text-sm w-44" [(ngModel)]="filterModStatus" (ngModelChange)="triggerSearch()">
        @for (opt of modOptions; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </div>

    <!-- Toggles -->
    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-2 cursor-pointer text-sm select-none">
        <input type="checkbox" class="rounded" [(ngModel)]="filterLowStock" (ngModelChange)="triggerSearch()" />
        <span class="text-warning-700 font-medium">Solo bajo stock</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm select-none">
        <input type="checkbox" class="rounded" [(ngModel)]="filterPendingPrice" (ngModelChange)="triggerSearch()" />
        <span class="text-warning-700 font-medium">Solo precio pendiente</span>
      </label>
    </div>

    <!-- Clear -->
    @if (hasActiveFilters()) {
      <button class="text-xs text-primary-600 hover:underline mt-auto" (click)="clearFilters()">
        Limpiar filtros
      </button>
    }
  </div>

  <!-- Dietary tags multi-select -->
  <div class="mt-3 pt-3 border-t border-gray-100">
    <p class="text-xs text-gray-500 mb-2">Etiquetas dietéticas</p>
    <div class="flex flex-wrap gap-2">
      @for (tag of dietaryTags; track tag.key) {
        <button
          class="px-2.5 py-1 rounded-full border text-xs transition-all"
          [class]="filterDietaryTags.includes(tag.key)
            ? 'border-success-500 bg-success-50 text-success-700 font-semibold'
            : 'border-gray-200 text-gray-500 hover:border-gray-300'"
          (click)="toggleDietaryTag(tag.key)"
        >{{ tag.label }}</button>
      }
    </div>
  </div>
</div>

<!-- ─── Anomaly alerts ────────────────────────────────────────────────────────── -->
@if (anomalies() && anomalyTotal() > 0) {
  <div class="mb-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="px-4 py-3 bg-error-50 border-b border-error-100 flex items-center gap-2">
      <span class="text-lg">🚨</span>
      <h3 class="text-sm font-bold text-error-700">Alertas de catálogo</h3>
      <span class="ml-auto text-xs text-error-600">{{ anomalyTotal() }} anomalía{{ anomalyTotal() === 1 ? '' : 's' }} detectada{{ anomalyTotal() === 1 ? '' : 's' }}</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
      @if (anomalies()!.priceGreaterThanVenue > 0) {
        <button class="flex flex-col items-center gap-1 p-4 hover:bg-red-50 transition-colors text-left"
                (click)="applyAnomalyFilter('priceVsVenue')">
          <span class="text-xl">💸</span>
          <span class="text-lg font-bold text-error-700">{{ anomalies()!.priceGreaterThanVenue }}</span>
          <span class="text-[11px] text-gray-500 text-center">Precio app &gt; precio en sala</span>
        </button>
      }
      @if (anomalies()!.missingPhoto > 0) {
        <button class="flex flex-col items-center gap-1 p-4 hover:bg-orange-50 transition-colors"
                (click)="applyAnomalyFilter('noPhoto')">
          <span class="text-xl">📷</span>
          <span class="text-lg font-bold text-warning-700">{{ anomalies()!.missingPhoto }}</span>
          <span class="text-[11px] text-gray-500 text-center">Sin foto</span>
        </button>
      }
      @if (anomalies()!.missingDescription > 0) {
        <button class="flex flex-col items-center gap-1 p-4 hover:bg-orange-50 transition-colors"
                (click)="applyAnomalyFilter('noDesc')">
          <span class="text-xl">📝</span>
          <span class="text-lg font-bold text-warning-700">{{ anomalies()!.missingDescription }}</span>
          <span class="text-[11px] text-gray-500 text-center">Sin descripción</span>
        </button>
      }
      @if (anomalies()!.missingCategory > 0) {
        <button class="flex flex-col items-center gap-1 p-4 hover:bg-orange-50 transition-colors"
                (click)="applyAnomalyFilter('noCategory')">
          <span class="text-xl">🗂️</span>
          <span class="text-lg font-bold text-warning-700">{{ anomalies()!.missingCategory }}</span>
          <span class="text-[11px] text-gray-500 text-center">Sin categoría</span>
        </button>
      }
    </div>
  </div>
}

<!-- ─── Result count + pagination info ──────────────────────────────────────── -->
@if (totalCount() > 0) {
  <div class="flex items-center justify-between mb-3">
    <p class="text-xs text-gray-500">
      Mostrando <strong>{{ results().length }}</strong> de <strong>{{ totalCount() }}</strong> productos
    </p>
    @if (totalPages() > 1) {
      <div class="flex items-center gap-2">
        <button class="btn-secondary text-xs px-3 py-1.5"
                [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">← Anterior</button>
        <span class="text-xs text-gray-500">Página {{ currentPage() }} / {{ totalPages() }}</span>
        <button class="btn-secondary text-xs px-3 py-1.5"
                [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">Siguiente →</button>
      </div>
    }
  </div>
}

<!-- ─── Loading skeleton ─────────────────────────────────────────────────────── -->
@if (loading() && results().length === 0) {
  <div class="space-y-2">
    @for (_ of [1,2,3,4,5,6]; track $index) {
      <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 animate-pulse">
        <div class="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0"></div>
        <div class="flex-1 space-y-2">
          <div class="h-4 bg-gray-100 rounded w-2/5"></div>
          <div class="h-3 bg-gray-100 rounded w-1/3"></div>
        </div>
        <div class="space-y-1.5 text-right">
          <div class="h-4 bg-gray-100 rounded w-16"></div>
          <div class="h-3 bg-gray-100 rounded w-12"></div>
        </div>
      </div>
    }
  </div>
}

<!-- ─── Error state ───────────────────────────────────────────────────────────── -->
@if (errorMsg()) {
  <div class="bg-error-50 border border-error-200 rounded-xl p-4 text-sm text-error-700 flex items-center gap-2">
    <span>⚠️</span> {{ errorMsg() }}
    <button class="ml-auto text-xs underline" (click)="triggerSearch()">Reintentar</button>
  </div>
}

<!-- ─── Empty state ───────────────────────────────────────────────────────────── -->
@if (!loading() && !errorMsg() && hasSearched() && results().length === 0) {
  <app-admin-empty-state
    icon="search"
    title="Sin resultados"
    description="Prueba con otros términos o ajusta los filtros."
    variant="soft" />
}

<!-- ─── Initial empty state ─────────────────────────────────────────────────── -->
@if (!loading() && !hasSearched()) {
  <app-admin-empty-state
    icon="search"
    title="Escribe para buscar"
    description="Busca en nombre, descripción, marca, SKU o código de barras."
    variant="soft" />
}

<!-- ─── Results list ──────────────────────────────────────────────────────────── -->
@if (!loading() && results().length > 0) {
  <div class="space-y-2">
    @for (item of results(); track item.id) {
      <button
        class="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-4 hover:shadow-sm hover:border-primary-200 transition-all text-left"
        (click)="navigate(item)"
      >
        <!-- Thumbnail -->
        <div class="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center text-xl">
          @if (item.photo_url) {
            <img [src]="item.photo_url" class="w-full h-full object-cover" alt="" />
          } @else {
            📦
          }
        </div>

        <!-- Name & store -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-0.5">
            <p class="text-sm font-semibold text-gray-800 truncate">{{ item.name }}</p>
            @if (item.is_featured) { <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-bold">⭐ Destacado</span> }
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1">
              @if (item.store_logo) {
                <img [src]="item.store_logo" class="w-4 h-4 rounded object-cover" alt="" />
              }
              <span class="text-xs text-gray-500 truncate max-w-[140px]">{{ item.store_name }}</span>
            </div>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{{ item.store_type }}</span>
            @if (item.category_name && item.category_name !== '—') {
              <span class="text-[10px] text-gray-400">{{ item.category_name }}</span>
            }
            @if (item.sku) {
              <span class="text-[10px] text-gray-400 font-mono">SKU: {{ item.sku }}</span>
            }
            @if (item.variants_count > 0) {
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">{{ item.variants_count }} variantes</span>
            }
          </div>
        </div>

        <!-- Price + badges -->
        <div class="flex flex-col items-end gap-1 flex-shrink-0">
          <div class="text-sm font-bold text-gray-800">RD\${{ item.price | number:'1.0-0' }}</div>
          @if (item.discount_price) {
            <div class="text-[10px] text-success-600 font-medium line-through opacity-60">RD\${{ item.discount_price | number:'1.0-0' }}</div>
          }
          <div class="flex gap-1 flex-wrap justify-end">
            <!-- Stock status -->
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  [class]="stockClass(item.stock_status)">
              {{ stockIcon(item.stock_status) }}
              {{ item.stock_status === 'no_controlado' ? '' : (item.stock_count ?? '') }}
            </span>
            <!-- Moderation -->
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  [class]="modClass(item.moderation_status)">
              {{ modLabel(item.moderation_status) }}
            </span>
            <!-- Pending price -->
            @if (item.price_pending != null) {
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-warning-100 text-warning-700 font-bold">
                💰 {{ item.price_change_pct! > 0 ? '+' : '' }}{{ item.price_change_pct }}%
              </span>
            }
            <!-- Price > venue anomaly -->
            @if (item.in_venue_price && item.price > item.in_venue_price) {
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-error-100 text-error-700 font-bold" title="Precio en app mayor que en sala" aria-label="Precio en app mayor que en sala" role="img">⚠️ App&gt;Sala</span>
            }
          </div>
        </div>

        <!-- Navigate arrow -->
        <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    }
  </div>

  <!-- Bottom pagination -->
  @if (totalPages() > 1) {
    <div class="flex items-center justify-center gap-2 mt-5">
      <button class="btn-secondary text-sm px-4"
              [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">← Anterior</button>
      <span class="text-sm text-gray-500">{{ currentPage() }} / {{ totalPages() }}</span>
      <button class="btn-secondary text-sm px-4"
              [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">Siguiente →</button>
    </div>
  }
}
    `,
})
export class CatalogGlobalSearchPageComponent implements OnInit, OnDestroy {
    private readonly svc = inject(CatalogAdminService);
    private readonly router = inject(Router);
    private readonly toast = inject(ToastService);

    // State
    readonly results = signal<GlobalSearchResult[]>([]);
    readonly totalCount = signal(0);
    readonly loading = signal(false);
    readonly anomalies = signal<CatalogAnomalies | null>(null);
    readonly errorMsg = signal<string | null>(null);
    readonly hasSearched = signal(false);
    readonly currentPage = signal(1);

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

    // Filters
    searchQuery = '';
    filterType = '';
    filterMinPrice: number | null = null;
    filterMaxPrice: number | null = null;
    filterModStatus: ModerationStatus | 'all' = 'all';
    filterLowStock = false;
    filterPendingPrice = false;
    filterDietaryTags: string[] = [];

    readonly commerceTypes = COMMERCE_TYPES;
    readonly dietaryTags = DIETARY_TAGS;
    readonly modOptions = MOD_OPTIONS;

    private readonly pageSize = 30;
    private readonly searchSubject = new Subject<void>();
    private subscription?: Subscription;

    ngOnInit(): void {
        this.subscription = this.searchSubject
            .pipe(debounceTime(400), distinctUntilChanged())
            .subscribe(() => this.execute());

        this.svc.getCatalogAnomalies().subscribe({
            next: a => this.anomalies.set(a),
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }

    readonly anomalyTotal = computed(() => {
        const a = this.anomalies();
        if (!a) return 0;
        return a.priceGreaterThanVenue + a.missingPhoto + a.missingDescription + a.missingCategory;
    });

    readonly hasActiveFilters = computed(() =>
        !!this.filterType || this.filterMinPrice !== null || this.filterMaxPrice !== null ||
        this.filterModStatus !== 'all' || this.filterLowStock || this.filterPendingPrice ||
        this.filterDietaryTags.length > 0
    );

    onQueryChange(value: string): void {
        this.searchQuery = value;
        this.currentPage.set(1);
        this.searchSubject.next();
    }

    triggerSearch(): void {
        this.currentPage.set(1);
        this.searchSubject.next();
    }

    goToPage(page: number): void {
        this.currentPage.set(page);
        this.execute();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    clearFilters(): void {
        this.filterType = '';
        this.filterMinPrice = null;
        this.filterMaxPrice = null;
        this.filterModStatus = 'all';
        this.filterLowStock = false;
        this.filterPendingPrice = false;
        this.filterDietaryTags = [];
        this.triggerSearch();
    }

    toggleDietaryTag(key: string): void {
        if (this.filterDietaryTags.includes(key)) {
            this.filterDietaryTags = this.filterDietaryTags.filter(t => t !== key);
        } else {
            this.filterDietaryTags = [...this.filterDietaryTags, key];
        }
        this.triggerSearch();
    }

    /** Apply anomaly preset filters for quick exploration */
    applyAnomalyFilter(type: 'priceVsVenue' | 'noPhoto' | 'noDesc' | 'noCategory'): void {
        this.clearFilters();
        this.searchQuery = '';
        // We can't filter for "price > in_venue_price" via the search API directly,
        // so show an informational message and clear to let the user inspect
        if (type === 'priceVsVenue') {
            this.toast.info('Mostrando todos los productos con precio en sala configurado');
        }
        this.triggerSearch();
    }

    private execute(): void {
        if (!this.searchQuery.trim() && !this.hasActiveFilters()) {
            this.results.set([]);
            this.totalCount.set(0);
            this.hasSearched.set(false);
            return;
        }

        this.loading.set(true);
        this.errorMsg.set(null);
        this.hasSearched.set(true);

        const filters: GlobalSearchFilters = {
            query: this.searchQuery,
            page: this.currentPage(),
            page_size: this.pageSize,
        };
        if (this.filterType) filters.commerce_type = this.filterType;
        if (this.filterMinPrice !== null) filters.min_price = this.filterMinPrice;
        if (this.filterMaxPrice !== null) filters.max_price = this.filterMaxPrice;
        if (this.filterModStatus !== 'all') filters.moderation_status = this.filterModStatus;
        if (this.filterLowStock) filters.low_stock = true;
        if (this.filterPendingPrice) filters.pending_price = true;
        if (this.filterDietaryTags.length) filters.dietary_tags = this.filterDietaryTags;

        this.svc.globalSearch(filters).subscribe({
            next: ({ data, count }) => {
                this.results.set(data);
                this.totalCount.set(count);
                this.loading.set(false);
            },
            error: () => {
                this.errorMsg.set('Error al buscar productos. Intenta de nuevo.');
                this.loading.set(false);
            },
        });
    }

    navigate(item: GlobalSearchResult): void {
        this.router.navigate(['/catalog', item.store_id, 'products', item.id]);
    }

    // ─── Badge helpers ────────────────────────────────────────────────────────

    stockIcon(status: string): string {
        return STOCK_STATUS_LABELS[status] ?? '—';
    }

    stockClass(status: string): string {
        const map: Partial<Record<string, string>> = {
            disponible: 'bg-success-100 text-success-700',
            bajo_stock: 'bg-warning-100 text-warning-700',
            agotado: 'bg-error-100 text-error-700',
            no_controlado: 'bg-gray-100 text-gray-400',
        };
        return map[status] ?? 'bg-gray-100 text-gray-400';
    }

    modLabel(status: string): string {
        return MOD_LABELS[status] ?? status;
    }

    modClass(status: string): string {
        return MOD_CLASSES[status] ?? 'bg-gray-100 text-gray-500';
    }
}
