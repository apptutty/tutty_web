import {
    Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
    CatalogAdminService, CatalogProduct, CatalogFilters, ModerationStatus,
    StoreWithCatalogStats, CatalogChangeEntry, StoreCombo,
} from './services/catalog-admin.service';
import { MenuCategory } from '../../core/supabase/database.types';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

type PageTab = 'products' | 'categories' | 'combos' | 'history';

const MOD_LABELS: Record<ModerationStatus, string> = {
    aprobado: '✅ Aprobado',
    bajo_revision: '⚠️ Bajo revisión',
    retirado: '🔴 Retirado',
};
const MOD_COLORS: Record<ModerationStatus, string> = {
    aprobado: 'bg-success-100 text-success-700',
    bajo_revision: 'bg-warning-100 text-warning-700',
    retirado: 'bg-error-100 text-error-700',
};
const STOCK_LABELS: Record<string, string> = {
    disponible: '✅', bajo_stock: '⚠️', agotado: '🔴', no_controlado: '—',
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
    producto_creado: 'Producto creado',
    producto_editado: 'Producto editado',
    precio_actualizado: 'Precio actualizado',
    precio_aprobado: 'Precio aprobado',
    precio_rechazado: 'Precio rechazado',
    activado: 'Activado',
    desactivado: 'Desactivado',
    moderacion_aprobado: 'Moderación: aprobado',
    moderacion_bajo_revision: 'Moderación: bajo revisión',
    moderacion_retirado: 'Moderación: retirado',
};

@Component({
    selector: 'app-store-product-manager',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, TimeAgoPipe, AdminEmptyStateComponent],
    template: `
<!-- ─── Breadcrumb ─────────────────────────────────────────────────────────── -->
<div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
  <a routerLink="/catalog" class="hover:text-primary-600 transition-colors">Catálogos</a>
  <span>›</span>
  <span class="font-semibold text-gray-800">{{ storeInfo()?.name ?? storeId }}</span>
</div>

<!-- ─── Premium commerce header ───────────────────────────────────────────── -->
@if (storeInfo(); as store) {
  <section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_96%_18%,rgba(235,27,141,.1),transparent_28%),linear-gradient(180deg,#fff,#fbfcff)] p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)] mb-5">
    <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-14 h-14 rounded-2xl overflow-hidden bg-[#f4f6f9] grid place-items-center text-2xl flex-shrink-0">
          @if (store.logo_url) {
            <img [src]="store.logo_url" class="w-full h-full object-cover" alt="" />
          } @else { 🏪 }
        </div>
        <div class="min-w-0">
          <h1 class="text-[28px] leading-[1.05] tracking-[-0.03em] font-black text-[#111827] truncate">{{ store.name }}</h1>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span class="inline-flex items-center rounded-full bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-black text-[#667085]">{{ store.commerce_type }}</span>
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black"
                  [class]="store.is_open ? 'bg-[#eafbf1] text-[#087b3c]' : 'bg-[#f4f6f9] text-[#667085]'">
              {{ store.is_open ? 'Abierto' : 'Cerrado' }}
            </span>
            @if (!store.is_active) {
              <span class="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-1 text-[11px] font-black text-[#b42318]">Suspendido</span>
            }
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <a [routerLink]="['/catalog', storeId, 'products', 'new']"
           class="h-11 inline-flex items-center justify-center gap-1 rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-white text-sm font-black px-4 transition-colors">
          + Nuevo producto
        </a>
        <button class="h-11 inline-flex items-center justify-center gap-1 rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]"
                (click)="triggerImport()">
          📥 Importar CSV
        </button>
        <button class="h-11 inline-flex items-center justify-center gap-1 rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]"
                (click)="exportCsv()">
          📤 Exportar CSV
        </button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div class="rounded-2xl border border-[#eef1f6] bg-white px-3 py-2">
        <p class="text-xs font-bold text-[#98a2b3]">Productos</p>
        <p class="text-lg font-black text-[#111827]">{{ store.total_products }}</p>
      </div>
      <div class="rounded-2xl border border-[#eef1f6] bg-white px-3 py-2">
        <p class="text-xs font-bold text-[#98a2b3]">Categorías</p>
        <p class="text-lg font-black text-[#111827]">{{ store.categories_count }}</p>
      </div>
      <div class="rounded-2xl border border-[#eef1f6] bg-white px-3 py-2">
        <p class="text-xs font-bold text-[#98a2b3]">Precios pendientes</p>
        <p class="text-lg font-black text-[#b54708]">{{ store.pending_price_approval }}</p>
      </div>
      <div class="rounded-2xl border border-[#eef1f6] bg-white px-3 py-2">
        <p class="text-xs font-bold text-[#98a2b3]">Actualizado</p>
        <p class="text-lg font-black text-[#111827]">{{ store.last_catalog_update | timeAgo }}</p>
      </div>
    </div>
  </section>
}

<!-- ─── Segmented tabs ─────────────────────────────────────────────────────── -->
<div class="rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] p-1.5 mb-5 inline-flex flex-wrap gap-1">
  @for (tab of tabs; track tab.value) {
    <button class="h-10 px-4 rounded-xl text-sm font-bold transition-all"
            [attr.aria-current]="activeTab() === tab.value ? 'page' : null"
            [class]="activeTab() === tab.value ? 'bg-white text-[#111827] shadow-[0_8px_18px_rgba(17,24,39,.1)]' : 'text-[#667085] hover:bg-white/70'"
            (click)="activeTab.set(tab.value)">
      {{ tab.label }}
      @if (tab.value === 'products' && pendingCount() > 0) {
        <span class="ml-1 rounded-full bg-[#fff6e6] px-1.5 py-0.5 text-[10px] font-black text-[#b54708]">{{ pendingCount() }}</span>
      }
    </button>
  }
</div>

<!-- ════════════ TAB: PRODUCTOS ════════════════════════════════════════════════ -->
@if (activeTab() === 'products') {
  <div class="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_280px] gap-4">
    <div class="space-y-4 min-w-0">
      <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-2 mb-2">
          <div class="xl:col-span-2 relative">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input type="search" class="input-field pl-9 text-sm !h-12 !rounded-2xl" placeholder="Buscar producto por nombre, categoría o precio..."
                   [(ngModel)]="productSearch" (ngModelChange)="onProductSearch()" aria-label="Buscar producto por nombre, categoría o precio" />
          </div>
          <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="filterCategory" (ngModelChange)="reloadProducts(true)" aria-label="Filtrar por categoría">
            <option value="">Todas las categorías</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
          <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="filterModeration" (ngModelChange)="reloadProducts(true)" aria-label="Filtrar por moderación">
            <option value="all">Toda moderación</option>
            <option value="aprobado">Aprobado</option>
            <option value="bajo_revision">Pendiente</option>
            <option value="retirado">Rechazado</option>
          </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mb-3">
          <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="filterAvailability" (ngModelChange)="reloadProducts(true)" aria-label="Filtrar por disponibilidad">
            <option [ngValue]="null">Disponibilidad</option>
            <option [ngValue]="true">Disponibles</option>
            <option [ngValue]="false">No disponibles</option>
          </select>
          <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="filterStockStatus" (ngModelChange)="reloadProducts(true)" aria-label="Filtrar por stock">
            <option value="all">Todo stock</option>
            <option value="disponible">Con stock</option>
            <option value="bajo_stock">Bajo stock</option>
            <option value="agotado">Agotado</option>
            <option value="no_controlado">No controlado</option>
          </select>
          <input type="number" class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="filterMinPrice" (change)="reloadProducts(true)" placeholder="RD$ min" min="0" aria-label="Precio mínimo" />
          <input type="number" class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="filterMaxPrice" (change)="reloadProducts(true)" placeholder="RD$ max" min="0" aria-label="Precio máximo" />
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                  [class]="!hasProductFilters() ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'"
                  (click)="resetAllProductFilters()">Todos {{ totalCount() }}</button>
          <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                  [class]="filterPending ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'"
                  (click)="togglePendingQuick()">Solo precios pendientes {{ pendingCount() }}</button>
          <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                  [class]="filterStockStatus === 'agotado' ? 'bg-[#fee2e2] border-[#fecaca] text-[#b42318]' : 'border-[#e7eaf1] text-[#475467]'"
                  (click)="setStockQuick('agotado')">Agotados {{ outOfStockCount() }}</button>
          <div class="ml-auto flex items-center gap-2">
            <p class="text-xs font-semibold text-[#98a2b3]">{{ totalCount() }} productos</p>
            @if (hasProductFilters()) {
              <button type="button" class="h-8 rounded-xl border border-[#e7eaf1] px-3 text-xs font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="resetAllProductFilters()">Limpiar filtros</button>
            }
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#eef1f6] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-black text-[#111827]">Productos del catálogo</h3>
            <p class="text-sm text-[#98a2b3] font-semibold">{{ totalCount() }} productos encontrados</p>
          </div>
          @if (selectedIds().size > 0) {
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-[#667085] font-semibold">{{ selectedIds().size }} seleccionados</span>
              <button class="h-8 px-2 rounded-lg border border-[#dbe2ed] text-xs font-bold" (click)="bulkAvailability(true)">Activar</button>
              <button class="h-8 px-2 rounded-lg border border-[#dbe2ed] text-xs font-bold" (click)="bulkAvailability(false)">Desactivar</button>
              <button class="h-8 px-2 rounded-lg border border-[#ffd8a8] bg-[#fff6e6] text-[#b54708] text-xs font-bold" (click)="bulkModerateSel('retirado')">Retirar</button>
            </div>
          }
        </div>

        @if (productsLoading()) {
          <div class="p-4 space-y-2 animate-pulse">
            @for (_ of [1,2,3,4,5]; track $index) {
              <div class="h-11 rounded-xl bg-gray-100"></div>
            }
          </div>
        } @else if (productsLoadError()) {
          <div class="p-6">
            <app-admin-empty-state
              icon="default"
              title="No se pudo cargar el catálogo"
              description="Intenta refrescar la página o vuelve a intentarlo más tarde."
              variant="soft" />
            <div class="flex justify-center mt-3">
              <button class="h-10 px-4 rounded-xl border border-[#e7eaf1] text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="reloadProducts()">Reintentar</button>
            </div>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-[#fbfcff] border-b border-[#e7eaf1]">
                <tr>
                  <th class="w-10 px-4 py-2.5">
                    <input type="checkbox" class="rounded" aria-label="Seleccionar todos los productos visibles" (change)="toggleSelectAll($event)" />
                  </th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Producto</th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Categoría</th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Precio</th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Precio pendiente</th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Moderación</th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Stock</th>
                  <th class="px-4 py-2.5 text-left text-xs font-black text-[#667085] uppercase">Disponible</th>
                  <th class="px-4 py-2.5 text-right text-xs font-black text-[#667085] uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#eef1f6]">
                @for (p of products(); track p.id) {
                  <tr class="hover:bg-[#fbfcff] transition-colors" [class]="p.price_pending != null ? 'bg-[#fffaf2]' : ''">
                    <td class="px-4 py-3 text-center">
                      <input type="checkbox" class="rounded"
                             [attr.aria-label]="'Seleccionar producto ' + p.name"
                             [checked]="selectedIds().has(p.id)"
                             (change)="toggleSelect(p.id, $event)" />
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          @if (p.photo_url) {
                            <img [src]="p.photo_url" class="w-full h-full object-cover" alt="" />
                          } @else {
                            <div class="w-full h-full flex items-center justify-center text-gray-300 text-xs">📷</div>
                          }
                        </div>
                        <div class="min-w-0">
                          <p class="font-semibold text-[#111827] truncate max-w-[220px]">{{ p.name }}</p>
                          @if (p.sku) { <p class="text-[10px] text-[#98a2b3]">SKU: {{ p.sku }}</p> }
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-xs text-[#667085]">{{ p.category_name }}</td>
                    <td class="px-4 py-3">
                      <p class="font-black text-[#111827]">RD\${{ p.price | number:'1.0-0' }}</p>
                    </td>
                    <td class="px-4 py-3">
                      @if (p.price_pending != null) {
                        <div class="inline-flex items-center gap-1 rounded-full bg-[#fff6e6] px-2 py-1 text-[11px] font-black text-[#b54708]">
                          RD\${{ p.price_pending | number:'1.0-0' }}
                          <span>{{ p.price_change_pct! > 0 ? '+' : '' }}{{ p.price_change_pct }}%</span>
                        </div>
                      } @else {
                        <span class="text-[#c3c8d2] text-xs">—</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black"
                            [class]="p.moderation_status === 'aprobado'
                              ? 'bg-[#eafbf1] text-[#087b3c]'
                              : (p.moderation_status === 'bajo_revision' ? 'bg-[#fff6e6] text-[#b54708]' : 'bg-[#fee2e2] text-[#b42318]')">
                        {{ p.moderation_status === 'aprobado' ? 'Aprobado' : (p.moderation_status === 'bajo_revision' ? 'Pendiente' : 'Rechazado') }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-[#111827]">
                      {{ stockIcon(p) }}
                      @if (p.track_stock) { <span class="text-[10px] text-[#98a2b3] ml-0.5">{{ p.stock_count ?? 0 }}</span> }
                    </td>
                    <td class="px-4 py-3">
                      <button class="relative w-9 h-5 rounded-full transition-colors"
                              [class]="p.is_available ? 'bg-success-400' : 'bg-gray-300'"
                              (click)="quickToggleAvailability(p)"
                              role="switch"
                              [attr.aria-checked]="p.is_available"
                              [attr.aria-label]="p.is_available ? 'Desactivar disponibilidad de ' + p.name : 'Activar disponibilidad de ' + p.name">
                        <span class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                              [style.left]="p.is_available ? '17px' : '2px'"></span>
                      </button>
                    </td>
                    <td class="px-4 py-3">
                      <div class="inline-flex items-center justify-end gap-1 rounded-xl border border-[#e7eaf1] bg-white px-1 py-1">
                        <a [routerLink]="['/catalog', storeId, 'products', p.id]" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" [attr.aria-label]="'Editar producto ' + p.name">✏️</a>
                        <button class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" [attr.aria-label]="'Duplicar producto ' + p.name" (click)="duplicateProduct(p)">⧉</button>
                        @if (p.price_pending != null) {
                          <button class="p-1.5 rounded-lg hover:bg-warning-50 text-warning-600" [attr.aria-label]="'Revisar precio de ' + p.name" (click)="openPriceReview(p)">💰</button>
                        }
                        <button class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" [attr.aria-label]="'Moderar producto ' + p.name" (click)="openModerate(p)">🔍</button>
                        <button class="p-1.5 rounded-lg hover:bg-error-50 text-gray-400 hover:text-error-600" [attr.aria-label]="'Eliminar producto ' + p.name" (click)="deleteProduct(p)">🗑️</button>
                      </div>
                    </td>
                  </tr>
                }
                @if (products().length === 0) {
                  <tr>
                    <td colspan="9" class="px-4 py-7">
                      <app-admin-empty-state
                        icon="search"
                        [title]="productSearch.trim() || filterCategory || filterModeration !== 'all' || filterAvailability !== null || filterStockStatus !== 'all' || filterPending ? 'No hay productos para estos filtros' : 'Este comercio no tiene productos'"
                        [description]="productSearch.trim() || filterCategory || filterModeration !== 'all' || filterAvailability !== null || filterStockStatus !== 'all' || filterPending ? 'Prueba ajustando la búsqueda, categoría, moderación o disponibilidad.' : 'Los productos publicados aparecerán aquí.'"
                        variant="soft" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalCount() > pageSize) {
            <div class="flex items-center justify-between px-4 py-3 border-t border-[#eef1f6]">
              <p class="text-xs text-[#98a2b3] font-semibold">{{ totalCount() }} resultados</p>
              <div class="flex items-center gap-2">
                <button class="h-8 px-2 rounded-lg border border-[#e7eaf1] text-xs font-bold disabled:opacity-40" [disabled]="currentPage() === 1" (click)="goPage(currentPage() - 1)">← Ant</button>
                <span class="text-xs text-[#667085]">{{ currentPage() }} / {{ totalPages() }}</span>
                <button class="h-8 px-2 rounded-lg border border-[#e7eaf1] text-xs font-bold disabled:opacity-40" [disabled]="currentPage() === totalPages()" (click)="goPage(currentPage() + 1)">Sig →</button>
              </div>
            </div>
          }
        }
      </section>
    </div>

    <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 h-fit">
      <h3 class="text-sm font-black text-[#111827] mb-3">Resumen del catálogo</h3>
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between"><span class="text-[#667085]">Productos</span><strong class="text-[#111827]">{{ totalCount() }}</strong></div>
        <div class="flex items-center justify-between"><span class="text-[#667085]">Categorías</span><strong class="text-[#111827]">{{ categories().length }}</strong></div>
        <div class="flex items-center justify-between"><span class="text-[#667085]">Precios pendientes</span><strong class="text-[#b54708]">{{ pendingCount() }}</strong></div>
        <div class="flex items-center justify-between"><span class="text-[#667085]">Agotados</span><strong class="text-[#b42318]">{{ outOfStockCount() }}</strong></div>
        <div class="pt-2 border-t border-[#eef1f6]">
          <p class="text-xs text-[#98a2b3]">Última actualización</p>
          <p class="text-sm font-bold text-[#111827]">{{ storeInfo()?.last_catalog_update ? (storeInfo()!.last_catalog_update | timeAgo) : '—' }}</p>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-2">
        <button class="h-10 rounded-xl border border-[#e7eaf1] text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="triggerImport()">Importar CSV</button>
        <button class="h-10 rounded-xl border border-[#e7eaf1] text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="exportCsv()">Exportar CSV</button>
      </div>
    </aside>
  </div>
}

<!-- ════════════ TAB: CATEGORÍAS ═══════════════════════════════════════════════ -->
@if (activeTab() === 'categories') {
  <div class="bg-white border border-[#e7eaf1] rounded-3xl shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-[#eef1f6]">
      <p class="text-sm font-black text-[#111827]">Categorías del catálogo</p>
      <button
        class="h-10 flex items-center gap-1 px-4 text-xs font-bold bg-[#eb1b8d] hover:bg-[#c71473] text-white rounded-xl transition-colors"
        (click)="addingCategory.set(!addingCategory())"
      >+ Nueva categoría</button>
    </div>

    @if (addingCategory()) {
      <div class="flex items-center gap-2 px-5 py-3 bg-[#fbfcff] border-b border-[#eef1f6]">
        <input type="text" class="input-field text-sm flex-1 !h-11 !rounded-2xl" placeholder="Nombre de la categoría"
               [(ngModel)]="newCategoryName" (keydown.enter)="createCategory()" />
        <button class="h-10 px-4 rounded-xl bg-[#eb1b8d] hover:bg-[#c71473] text-white text-xs font-bold" (click)="createCategory()" [disabled]="!newCategoryName.trim()">Crear</button>
        <button class="h-10 px-4 rounded-xl border border-[#e7eaf1] text-xs font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="addingCategory.set(false)">Cancelar</button>
      </div>
    }

    <div class="divide-y divide-[#eef1f6]">
      @for (cat of categories(); track cat.id; let i = $index) {
        <div class="flex items-center gap-3 px-5 py-3 hover:bg-[#fbfcff] transition-colors">
          <span class="text-[#c3c8d2] text-xs select-none cursor-grab">⠿</span>
          <div class="flex-1 min-w-0">
            @if (editingCatId() === cat.id) {
              <input type="text" class="input-field text-sm py-1 !rounded-xl" [(ngModel)]="editingCatName"
                     (keydown.enter)="saveCategoryEdit(cat)" (keydown.escape)="editingCatId.set(null)" />
            } @else {
              <p class="text-sm font-semibold text-[#111827]">{{ cat.name }}</p>
            }
          </div>
          <span class="text-xs text-[#98a2b3] w-20 text-right">orden {{ cat.display_order }}</span>
          <label class="relative flex-shrink-0">
            <input type="checkbox" class="sr-only" [checked]="cat.is_active"
                   (change)="toggleCatActive(cat, $event)" />
            <div class="w-8 h-4 rounded-full transition-colors" [class]="cat.is_active ? 'bg-success-400' : 'bg-gray-200'"></div>
            <span class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                  [style.left]="cat.is_active ? '17px' : '2px'"></span>
          </label>
          <div class="flex items-center gap-1">
            @if (editingCatId() === cat.id) {
              <button class="text-xs px-2 py-1 bg-success-100 text-success-700 rounded" (click)="saveCategoryEdit(cat)" [attr.aria-label]="'Guardar categoría ' + cat.name">✓</button>
              <button class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded" (click)="editingCatId.set(null)" [attr.aria-label]="'Cancelar edición de categoría ' + cat.name">✕</button>
            } @else {
              <button class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                      [attr.aria-label]="'Editar categoría ' + cat.name"
                      (click)="startEditCat(cat)">✏️</button>
            }
          </div>
        </div>
      }
      @if (categories().length === 0) {
        <div class="px-4 py-4">
          <app-admin-empty-state
            icon="search"
            title="Sin categorías aún"
            description="Crea la primera categoría para organizar el catálogo."
            variant="soft" />
        </div>
      }
    </div>
  </div>
}

<!-- ════════════ TAB: COMBOS ═══════════════════════════════════════════════════ -->
@if (activeTab() === 'combos') {
  <div class="flex items-center justify-between mb-3">
    <p class="text-sm font-black text-[#111827]">Combos del comercio</p>
    <button class="h-10 px-4 rounded-xl bg-[#eb1b8d] hover:bg-[#c71473] text-white text-sm font-bold" (click)="openComboForm()">+ Nuevo combo</button>
  </div>

  @if (combos().length === 0 && !combosLoading()) {
    <app-admin-empty-state
      icon="search"
      title="Sin combos configurados"
      description="Crea un nuevo combo para este comercio."
      variant="soft" />
  }

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    @for (combo of combos(); track combo.id) {
      <div class="bg-white border border-[#e7eaf1] rounded-2xl p-4 flex items-start gap-3 shadow-[0_8px_24px_rgba(18,24,40,.07)] hover:shadow-[0_18px_42px_rgba(18,24,40,.11)] transition-all">
        <div class="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
          @if (combo.photo_url) {
            <img [src]="combo.photo_url" class="w-full h-full object-cover" alt="" />
          } @else { <div class="w-full h-full flex items-center justify-center text-xl">🎁</div> }
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-black text-[#111827] truncate">{{ combo.name }}</p>
            <span class="text-sm font-black text-[#eb1b8d] flex-shrink-0">RD\${{ combo.price | number:'1.0-0' }}</span>
          </div>
          @if (combo.description) {
            <p class="text-xs text-[#667085] mt-0.5 line-clamp-1">{{ combo.description }}</p>
          }
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  [class]="combo.is_active ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'">
              {{ combo.is_active ? 'Activo' : 'Inactivo' }}
            </span>
            <div class="flex items-center gap-1 ml-auto">
              <button class="text-xs px-2 py-1 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                      [attr.aria-label]="'Editar combo ' + combo.name"
                      (click)="openComboForm(combo)">✏️</button>
              <button class="text-xs px-2 py-1 hover:bg-error-50 rounded text-gray-400 hover:text-error-500 transition-colors"
                      [attr.aria-label]="'Eliminar combo ' + combo.name"
                      (click)="deleteCombo(combo.id)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    }
  </div>
}

<!-- ════════════ TAB: HISTORIAL ════════════════════════════════════════════════ -->
@if (activeTab() === 'history') {
  <div class="bg-white border border-[#e7eaf1] rounded-3xl shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-[#eef1f6]">
      <p class="text-sm font-black text-[#111827]">Historial de cambios</p>
      <p class="text-xs text-[#98a2b3]">Últimas 50 entradas</p>
    </div>

    @if (historyLoading()) {
      <div class="p-8 text-center text-[#98a2b3] animate-pulse">Cargando historial…</div>
    } @else {
      <div class="divide-y divide-[#eef1f6] max-h-[500px] overflow-y-auto">
        @for (entry of changeLog(); track entry.id) {
          <div class="flex items-start gap-3 px-5 py-3 hover:bg-[#fbfcff] transition-colors">
            <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0 font-bold text-[#667085]">
              {{ entry.changed_by_name.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold text-[#111827]">{{ entry.changed_by_name }}</span>
                <span class="text-xs px-1.5 py-0.5 bg-[#f4f6f9] text-[#667085] rounded-full">{{ changeTypeLabel(entry.change_type) }}</span>
                @if (entry.product_name) {
                  <span class="text-xs text-[#667085] truncate max-w-[200px]">{{ entry.product_name }}</span>
                }
              </div>
              @if (entry.notes) {
                <p class="text-xs text-[#98a2b3] mt-0.5">{{ entry.notes }}</p>
              }
            </div>
            <span class="text-[10px] text-[#98a2b3] flex-shrink-0">{{ entry.created_at | timeAgo }}</span>
          </div>
        }
        @if (changeLog().length === 0) {
          <div class="px-4 py-4">
            <app-admin-empty-state
              icon="search"
              title="Sin historial aún"
              description="Todavía no hay cambios registrados para este comercio."
              variant="soft" />
          </div>
        }
      </div>
    }
  </div>
}

<!-- ─── Combo form modal ──────────────────────────────────────────────────── -->
@if (showComboModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" (click)="showComboModal.set(false)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-base font-bold text-gray-800 mb-4">
        {{ editingCombo() ? 'Editar combo' : 'Nuevo combo' }}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="label text-xs mb-1 block">Nombre *</label>
          <input type="text" class="input-field text-sm" [(ngModel)]="comboForm.name"
                 placeholder="Ej: Combo familia" maxlength="80" />
        </div>
        <div>
          <label class="label text-xs mb-1 block">Descripción</label>
          <textarea class="input-field text-sm resize-none" rows="2"
                    [(ngModel)]="comboForm.description" placeholder="Qué incluye…"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label text-xs mb-1 block">Precio (RD\$) *</label>
            <input type="number" class="input-field text-sm" [(ngModel)]="comboForm.price" min="1" />
          </div>
          <div>
            <label class="label text-xs mb-1 block">URL foto</label>
            <input type="url" class="input-field text-sm" [(ngModel)]="comboForm.photo_url" placeholder="https://…" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label text-xs mb-1 block">Disponible desde</label>
            <input type="time" class="input-field text-sm" [(ngModel)]="comboForm.available_from" />
          </div>
          <div>
            <label class="label text-xs mb-1 block">Disponible hasta</label>
            <input type="time" class="input-field text-sm" [(ngModel)]="comboForm.available_until" />
          </div>
        </div>
        @if (comboForm.available_from && comboForm.available_until &&
             comboForm.available_from >= comboForm.available_until) {
          <p class="text-xs text-error-600">⚠️ La hora de inicio debe ser anterior a la de fin</p>
        }
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" class="rounded" [(ngModel)]="comboForm.is_active" />
          <span>Activo</span>
        </label>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button class="btn-secondary text-sm" (click)="showComboModal.set(false)">Cancelar</button>
        <button class="btn-primary text-sm"
                (click)="saveCombo()"
                [disabled]="comboSaving() || !comboForm.name.trim() || comboForm.price <= 0">
          {{ comboSaving() ? 'Guardando…' : (editingCombo() ? 'Guardar cambios' : 'Crear combo') }}
        </button>
      </div>
    </div>
  </div>
}

<!-- ─── Price review modal ────────────────────────────────────────────────── -->
@if (reviewingProduct()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" (click)="reviewingProduct.set(null)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
      <h3 class="text-base font-bold text-gray-800 mb-1">Revisión de precio</h3>
      <p class="text-sm text-gray-600 mb-4">{{ reviewingProduct()!.name }}</p>

      <div class="grid grid-cols-3 gap-3 mb-4 text-center">
        <div class="p-3 bg-gray-50 rounded-xl">
          <p class="text-xs text-gray-400 mb-1">Precio actual</p>
          <p class="font-bold text-gray-800">RD\${{ reviewingProduct()!.price | number:'1.0-0' }}</p>
        </div>
        <div class="flex items-center justify-center text-gray-400">→</div>
        <div class="p-3 bg-warning-50 rounded-xl">
          <p class="text-xs text-warning-600 mb-1">Precio propuesto</p>
          <p class="font-bold text-warning-700">RD\${{ reviewingProduct()!.price_pending | number:'1.0-0' }}</p>
        </div>
      </div>

      @if (reviewingProduct()!.price_pending_notes) {
        <div class="p-3 bg-gray-50 rounded-lg mb-4">
          <p class="text-xs text-gray-500 font-medium mb-1">Nota del comercio:</p>
          <p class="text-sm text-gray-700">{{ reviewingProduct()!.price_pending_notes }}</p>
        </div>
      }

      <div class="flex gap-3">
        <button
          class="flex-1 px-3 py-2 bg-success-600 hover:bg-success-700 text-white text-sm font-semibold rounded-xl transition-colors"
          (click)="doApprovePrice()"
          [disabled]="priceActionBusy()"
        >✅ Aprobar precio</button>
        <button
          class="flex-1 px-3 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-semibold rounded-xl transition-colors"
          (click)="showRejectInline.set(true)"
        >❌ Rechazar</button>
      </div>

      @if (showRejectInline()) {
        <div class="mt-3">
          <textarea class="input-field text-sm resize-none w-full mt-2" rows="2"
                    [(ngModel)]="priceRejectReason"
                    placeholder="Motivo del rechazo (obligatorio)…"></textarea>
          <button
            class="w-full mt-2 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-semibold rounded-xl transition-colors"
            (click)="doRejectPrice()"
            [disabled]="!priceRejectReason.trim() || priceActionBusy()"
          >Confirmar rechazo</button>
        </div>
      }
    </div>
  </div>
}

<!-- ─── Moderation modal ──────────────────────────────────────────────────── -->
@if (moderatingProduct()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" (click)="moderatingProduct.set(null)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
      <h3 class="text-base font-bold text-gray-800 mb-4">Moderar producto</h3>
      <p class="text-sm text-gray-600 mb-3">{{ moderatingProduct()!.name }}</p>

      <div class="grid grid-cols-3 gap-2 mb-4">
        @for (st of moderationStatuses; track st.value) {
          <button
            class="flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs font-medium"
            [class]="modStatusSel === st.value ? st.selectedClass : 'border-gray-200 text-gray-500 hover:border-gray-300'"
            (click)="modStatusSel = st.value"
          >{{ st.icon }}<span>{{ st.label }}</span></button>
        }
      </div>

      @if (modStatusSel !== 'aprobado') {
        <div class="mb-4">
          <label class="label text-xs mb-1 block">Notas de moderación</label>
          <textarea class="input-field text-sm resize-none w-full" rows="3"
                    [(ngModel)]="modNotes"
                    placeholder="Explica el motivo al comercio…"></textarea>
        </div>
      }

      <label class="flex items-center gap-2 text-xs mb-4 cursor-pointer">
        <input type="checkbox" class="rounded" [(ngModel)]="modNotify" />
        Notificar al comercio
      </label>

      <div class="flex gap-3">
        <button class="btn-secondary flex-1 text-sm" (click)="moderatingProduct.set(null)">Cancelar</button>
        <button
          class="btn-primary flex-1 text-sm"
          (click)="doModerate()"
          [disabled]="modBusy() || (modStatusSel !== 'aprobado' && !modNotes.trim())"
        >{{ modBusy() ? 'Guardando…' : 'Aplicar' }}</button>
      </div>
    </div>
  </div>
}

<!-- ─── CSV Import modal ──────────────────────────────────────────────────── -->
@if (showCsvModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" (click)="showCsvModal.set(false)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 p-6 max-h-[85vh] flex flex-col">
      <h3 class="text-base font-bold text-gray-800 mb-4">Importar productos desde CSV</h3>

      @if (!csvPreview()) {
        <div class="flex-1 flex items-center justify-center">
          <label class="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
            <span class="text-4xl">📥</span>
            <p class="text-sm font-medium text-gray-700">Haz clic para seleccionar un archivo CSV</p>
            <p class="text-xs text-gray-400">Columnas: name/nombre, price/precio, category/categoria</p>
            <input type="file" accept=".csv" class="hidden" (change)="onCsvFile($event)" />
          </label>
        </div>
      } @else {
        <div class="flex-1 overflow-y-auto">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-xs px-2 py-1 bg-success-100 text-success-700 rounded-full font-medium">✅ {{ csvPreview()!.valid }} válidos</span>
            @if (csvPreview()!.invalid > 0) {
              <span class="text-xs px-2 py-1 bg-error-100 text-error-700 rounded-full font-medium">❌ {{ csvPreview()!.invalid }} con errores</span>
            }
          </div>
          <table class="w-full text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left">Fila</th>
                <th class="px-3 py-2 text-left">Nombre</th>
                <th class="px-3 py-2 text-left">Precio</th>
                <th class="px-3 py-2 text-left">Categoría</th>
                <th class="px-3 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of csvPreview()!.preview.slice(0, 20); track row.row) {
                <tr [class]="row.errors.length > 0 ? 'bg-error-50' : ''">
                  <td class="px-3 py-1.5 text-gray-400">{{ row.row }}</td>
                  <td class="px-3 py-1.5">{{ row.name }}</td>
                  <td class="px-3 py-1.5">RD\${{ row.price }}</td>
                  <td class="px-3 py-1.5 text-gray-500">{{ row.category }}</td>
                  <td class="px-3 py-1.5">
                    @if (row.errors.length > 0) {
                      <span class="text-error-600">{{ row.errors.join(', ') }}</span>
                    } @else {
                      <span class="text-success-600">✓ OK</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex gap-3 mt-4 pt-4 border-t border-gray-100">
          <button class="btn-secondary text-sm" (click)="csvPreview.set(null)">← Elegir otro</button>
          <button
            class="btn-primary text-sm flex-1"
            (click)="commitCsvImport()"
            [disabled]="csvPreview()!.valid === 0 || importing()"
          >
            {{ importing() ? 'Importando…' : 'Importar ' + csvPreview()!.valid + ' productos' }}
          </button>
        </div>
      }
    </div>
  </div>
}
    `,
})
export class StoreProductManagerPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly svc = inject(CatalogAdminService);
    private readonly toast = inject(ToastService);
    private readonly confirm = inject(ConfirmService);

    storeId = '';

    // ── State ─────────────────────────────────────────────────────────────────

    readonly activeTab = signal<PageTab>('products');
    readonly storeInfo = signal<StoreWithCatalogStats | null>(null);

    // Products tab
    readonly products = signal<CatalogProduct[]>([]);
    readonly productsLoading = signal(true);
    readonly productsLoadError = signal(false);
    readonly totalCount = signal(0);
    readonly currentPage = signal(1);
    readonly pageSize = 30;
    readonly selectedIds = signal<Set<string>>(new Set());

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
    readonly pendingCount = computed(() => this.products().filter(p => p.price_pending != null).length);
    readonly outOfStockCount = computed(() => this.products().filter(p => p.stock_status === 'agotado').length);
    readonly reviewCount = computed(() => this.products().filter(p => p.moderation_status === 'bajo_revision').length);
    readonly unavailableCount = computed(() => this.products().filter(p => !p.is_available).length);

    productSearch = '';
    filterCategory = '';
    filterModeration: ModerationStatus | 'all' = 'all';
    filterPending = false;
    filterAvailability: boolean | null = null; // null = all
    filterMinPrice: number | null = null;
    filterMaxPrice: number | null = null;
    filterStockStatus: string = 'all';

    // Categories tab
    readonly categories = signal<MenuCategory[]>([]);
    readonly addingCategory = signal(false);
    newCategoryName = '';
    readonly editingCatId = signal<string | null>(null);
    editingCatName = '';

    // Combos tab
    readonly combos = signal<StoreCombo[]>([]);
    readonly combosLoading = signal(false);
    readonly showComboModal = signal(false);
    readonly editingCombo = signal<StoreCombo | null>(null);
    readonly comboSaving = signal(false);
    comboForm: {
        name: string; description: string; price: number;
        photo_url: string; is_active: boolean;
        available_from: string; available_until: string;
    } = this.emptyComboForm();

    // History tab
    readonly changeLog = signal<CatalogChangeEntry[]>([]);
    readonly historyLoading = signal(false);

    // Modals
    readonly reviewingProduct = signal<CatalogProduct | null>(null);
    readonly moderatingProduct = signal<CatalogProduct | null>(null);
    readonly priceActionBusy = signal(false);
    readonly modBusy = signal(false);
    readonly showRejectInline = signal(false);

    priceRejectReason = '';
    modStatusSel: ModerationStatus = 'aprobado';
    modNotes = '';
    modNotify = true;

    // CSV import
    readonly showCsvModal = signal(false);
    readonly csvPreview = signal<import('./services/catalog-admin.service').ImportResult | null>(null);
    readonly importing = signal(false);
    private csvFile: File | null = null;

    private searchTimeout: ReturnType<typeof setTimeout> | null = null;

    // ── Static config ─────────────────────────────────────────────────────────

    readonly tabs: { value: PageTab; label: string }[] = [
        { value: 'products', label: 'Productos' },
        { value: 'categories', label: 'Categorías' },
        { value: 'combos', label: 'Combos' },
        { value: 'history', label: 'Historial de cambios' },
    ];

    readonly moderationStatuses: { value: ModerationStatus; label: string; icon: string; selectedClass: string }[] = [
        { value: 'aprobado', label: 'Aprobado', icon: '✅', selectedClass: 'border-success-500 bg-success-50 text-success-700' },
        { value: 'bajo_revision', label: 'Bajo revisión', icon: '⚠️', selectedClass: 'border-warning-400 bg-warning-50 text-warning-700' },
        { value: 'retirado', label: 'Retirado', icon: '🔴', selectedClass: 'border-error-500 bg-error-50 text-error-700' },
    ];

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnInit(): void {
        this.storeId = this.route.snapshot.paramMap.get('storeId') ?? '';
        this.loadStoreInfo();
        this.loadCategories();
        this.reloadProducts();

        // Lazy-load when tab changes via effect pattern — done in click handler
    }

    private loadStoreInfo(): void {
        this.svc.getStoresWithCatalogStats({ search: undefined }).subscribe({
            next: stores => {
                const found = stores.find(s => s.id === this.storeId);
                this.storeInfo.set(found ?? null);
            },
        });
    }

    private loadCategories(): void {
        this.svc.getCategories(this.storeId).subscribe({ next: cats => this.categories.set(cats) });
    }

    reloadProducts(resetPage = false): void {
        if (resetPage) this.currentPage.set(1);
        this.productsLoading.set(true);
        this.productsLoadError.set(false);
        const filters: CatalogFilters = {
            page: this.currentPage(),
            page_size: this.pageSize,
            category_id: this.filterCategory || undefined,
            search: this.productSearch || undefined,
            moderation_status: this.filterModeration,
            has_pending_price: this.filterPending || undefined,
            is_available: this.filterAvailability ?? undefined,
            stock_status: (this.filterStockStatus !== 'all' ? this.filterStockStatus : undefined) as any,
            min_price: this.filterMinPrice ?? undefined,
            max_price: this.filterMaxPrice ?? undefined,
        }; this.svc.getCatalog(this.storeId, filters).subscribe({
            next: ({ data, count }) => {
                this.products.set(data);
                this.totalCount.set(count);
                this.selectedIds.set(new Set());
                this.productsLoading.set(false);
            },
            error: () => {
                this.productsLoading.set(false);
                this.productsLoadError.set(true);
            },
        });
    }

    hasProductFilters(): boolean {
        return Boolean(
            this.productSearch.trim() ||
            this.filterCategory ||
            this.filterModeration !== 'all' ||
            this.filterPending ||
            this.filterAvailability !== null ||
            this.filterStockStatus !== 'all' ||
            this.filterMinPrice !== null ||
            this.filterMaxPrice !== null
        );
    }

    resetAllProductFilters(): void {
        this.productSearch = '';
        this.filterCategory = '';
        this.filterModeration = 'all';
        this.filterPending = false;
        this.filterAvailability = null;
        this.filterStockStatus = 'all';
        this.filterMinPrice = null;
        this.filterMaxPrice = null;
        this.reloadProducts(true);
    }

    clearProductQuickFilters(): void {
        this.filterModeration = 'all';
        this.filterPending = false;
        this.filterAvailability = null;
        this.filterStockStatus = 'all';
        this.reloadProducts(true);
    }

    togglePendingQuick(): void {
        this.filterPending = !this.filterPending;
        this.reloadProducts(true);
    }

    setStockQuick(status: string): void {
        this.filterStockStatus = this.filterStockStatus === status ? 'all' : status;
        this.reloadProducts(true);
    }

    setModerationQuick(status: ModerationStatus): void {
        this.filterModeration = this.filterModeration === status ? 'all' : status;
        this.reloadProducts(true);
    }

    setAvailabilityQuick(available: boolean): void {
        this.filterAvailability = this.filterAvailability === available ? null : available;
        this.reloadProducts(true);
    }

    onProductSearch(): void {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.reloadProducts(true), 300);
    }

    goPage(page: number): void {
        this.currentPage.set(page);
        this.reloadProducts();
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
        this.selectedIds.set(checked ? new Set(this.products().map(p => p.id)) : new Set());
    }

    // ─── Bulk actions ─────────────────────────────────────────────────────────

    async bulkAvailability(available: boolean): Promise<void> {
        const ids = [...this.selectedIds()];
        if (!ids.length) return;
        try {
            await this.svc.bulkUpdateAvailability(ids, available);
            this.toast.success(`${ids.length} productos ${available ? 'activados' : 'desactivados'}`);
            this.reloadProducts();
        } catch {
            this.toast.error('Error en la acción masiva');
        }
    }

    async bulkModerateSel(status: ModerationStatus): Promise<void> {
        const ids = [...this.selectedIds()];
        if (!ids.length) return;
        const ok = await this.confirm.confirm({
            title: 'Retirar por moderación',
            message: `¿Retirar ${ids.length} productos? Se ocultarán para los clientes.`,
            confirmText: 'Retirar', danger: true,
        });
        if (!ok) return;
        try {
            await Promise.all(ids.map(id => this.svc.moderateProduct(id, status, 'Retirado en bulk por moderación', false)));
            this.toast.success(`${ids.length} productos retirados`);
            this.reloadProducts();
        } catch {
            this.toast.error('Error al retirar productos');
        }
    }

    // ─── Quick toggle ─────────────────────────────────────────────────────────

    async quickToggleAvailability(p: CatalogProduct): Promise<void> {
        try {
            await this.svc.bulkUpdateAvailability([p.id], !p.is_available);
            this.products.update(prev => prev.map(item => item.id === p.id ? { ...item, is_available: !item.is_available } : item));
        } catch {
            this.toast.error('Error al cambiar disponibilidad');
        }
    }

    // ─── Price review ─────────────────────────────────────────────────────────

    openPriceReview(p: CatalogProduct): void {
        this.reviewingProduct.set(p);
        this.showRejectInline.set(false);
        this.priceRejectReason = '';
    }

    async doApprovePrice(): Promise<void> {
        const p = this.reviewingProduct();
        if (!p) return;
        this.priceActionBusy.set(true);
        try {
            await this.svc.approvePendingPrice(p.id);
            this.toast.success('✅ Precio aprobado');
            this.reviewingProduct.set(null);
            this.reloadProducts();
        } catch {
            this.toast.error('Error al aprobar precio');
        } finally {
            this.priceActionBusy.set(false);
        }
    }

    async doRejectPrice(): Promise<void> {
        const p = this.reviewingProduct();
        if (!p || !this.priceRejectReason.trim()) return;
        this.priceActionBusy.set(true);
        try {
            await this.svc.rejectPendingPrice(p.id, this.priceRejectReason.trim());
            this.toast.success('Precio rechazado');
            this.reviewingProduct.set(null);
            this.reloadProducts();
        } catch {
            this.toast.error('Error al rechazar precio');
        } finally {
            this.priceActionBusy.set(false);
        }
    }

    // ─── Moderation ───────────────────────────────────────────────────────────

    openModerate(p: CatalogProduct): void {
        this.moderatingProduct.set(p);
        this.modStatusSel = p.moderation_status;
        this.modNotes = '';
        this.modNotify = true;
    }

    async doModerate(): Promise<void> {
        const p = this.moderatingProduct();
        if (!p) return;
        this.modBusy.set(true);
        try {
            await this.svc.moderateProduct(p.id, this.modStatusSel, this.modNotes.trim(), this.modNotify);
            this.toast.success('Moderación aplicada');
            this.moderatingProduct.set(null);
            this.reloadProducts();
        } catch {
            this.toast.error('Error al moderar');
        } finally {
            this.modBusy.set(false);
        }
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    async deleteProduct(p: CatalogProduct): Promise<void> {
        const ok = await this.confirm.confirm({
            title: 'Eliminar producto',
            message: `¿Eliminar "${p.name}"? Esta acción no se puede deshacer y eliminará el registro del historial de precios.`,
            confirmText: 'Eliminar', danger: true,
        });
        if (!ok) return;
        try {
            const { error } = await this.svc.deleteProduct(p.id);
            if (error) throw new Error(error);
            this.toast.success('Producto eliminado');
            this.reloadProducts();
        } catch {
            this.toast.error('Error al eliminar producto');
        }
    }

    async duplicateProduct(p: CatalogProduct): Promise<void> {
        const ok = await this.confirm.confirm({
            title: 'Duplicar producto',
            message: `¿Crear una copia de "${p.name}"?`,
            confirmText: 'Duplicar',
        });
        if (!ok) return;
        try {
            const { error } = await this.svc.createProduct(this.storeId, {
                name: `${p.name} (copia)`,
                description: p.description ?? undefined,
                category_id: p.category_id ?? undefined,
                price: p.price,
                discount_price: p.discount_price ?? undefined,
                photo_url: p.photo_url ?? undefined,
                is_available: false, // draft until explicitly activated
                is_featured: false,
                track_stock: p.track_stock,
                stock_count: p.stock_count ?? undefined,
                low_stock_alert: p.low_stock_alert ?? undefined,
                sku: undefined, // must be unique
                moderation_status: 'bajo_revision',
                dietary_tags: (p as any).dietary_tags ?? [],
                notify_store: false,
            });
            if (error) throw new Error(error);
            this.toast.success(`Copia de "${p.name}" creada como borrador`);
            this.reloadProducts();
        } catch {
            this.toast.error('Error al duplicar producto');
        }
    }

    // ─── Categories ───────────────────────────────────────────────────────────

    async createCategory(): Promise<void> {
        if (!this.newCategoryName.trim()) return;
        try {
            const cat = await this.svc.createCategory(this.storeId, this.newCategoryName.trim());
            this.categories.update(prev => [...prev, cat]);
            this.newCategoryName = '';
            this.addingCategory.set(false);
            this.toast.success('Categoría creada');
        } catch {
            this.toast.error('Error al crear categoría');
        }
    }

    startEditCat(cat: MenuCategory): void {
        this.editingCatId.set(cat.id);
        this.editingCatName = cat.name;
    }

    async saveCategoryEdit(cat: MenuCategory): Promise<void> {
        if (!this.editingCatName.trim()) return;
        try {
            await this.svc.updateCategory(cat.id, { name: this.editingCatName.trim() });
            this.categories.update(prev => prev.map(c => c.id === cat.id ? { ...c, name: this.editingCatName.trim() } : c));
            this.editingCatId.set(null);
            this.toast.success('Categoría actualizada');
        } catch {
            this.toast.error('Error al actualizar categoría');
        }
    }

    async toggleCatActive(cat: MenuCategory, event: Event): Promise<void> {
        const active = (event.target as HTMLInputElement).checked;
        try {
            await this.svc.updateCategory(cat.id, { is_active: active });
            this.categories.update(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: active } : c));
        } catch {
            this.toast.error('Error al actualizar categoría');
        }
    }

    // ─── Combos ───────────────────────────────────────────────────────────────

    private emptyComboForm() {
        return { name: '', description: '', price: 0, photo_url: '', is_active: true, available_from: '', available_until: '' };
    }

    openComboForm(combo?: StoreCombo): void {
        this.editingCombo.set(combo ?? null);
        this.comboForm = combo
            ? { name: combo.name, description: combo.description ?? '', price: combo.price, photo_url: combo.photo_url ?? '', is_active: combo.is_active, available_from: combo.available_from ?? '', available_until: combo.available_until ?? '' }
            : this.emptyComboForm();
        this.showComboModal.set(true);
    }

    async saveCombo(): Promise<void> {
        if (!this.comboForm.name.trim() || this.comboForm.price <= 0) {
            this.toast.error('Nombre y precio son obligatorios');
            return;
        }
        // Validate time range
        if (this.comboForm.available_from && this.comboForm.available_until &&
            this.comboForm.available_from >= this.comboForm.available_until) {
            this.toast.error('La hora de inicio debe ser anterior a la hora de fin');
            return;
        }
        this.comboSaving.set(true);
        const data: Partial<StoreCombo> = {
            name: this.comboForm.name.trim(),
            description: this.comboForm.description.trim() || undefined,
            price: this.comboForm.price,
            photo_url: this.comboForm.photo_url.trim() || undefined,
            is_active: this.comboForm.is_active,
            available_from: this.comboForm.available_from || undefined,
            available_until: this.comboForm.available_until || undefined,
            items: [],
        };
        try {
            const editing = this.editingCombo();
            if (editing) {
                await this.svc.updateCombo(editing.id, data);
                this.combos.update(prev => prev.map(c => c.id === editing.id ? { ...c, ...data } : c));
                this.toast.success('Combo actualizado');
            } else {
                const created = await this.svc.createCombo(this.storeId, data);
                this.combos.update(prev => [...prev, created]);
                this.toast.success('Combo creado');
            }
            this.showComboModal.set(false);
        } catch {
            this.toast.error('Error al guardar el combo');
        } finally {
            this.comboSaving.set(false);
        }
    }

    async deleteCombo(id: string): Promise<void> {
        const ok = await this.confirm.confirm({ title: 'Eliminar combo', message: '¿Eliminar este combo?', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        try {
            await this.svc.deleteCombo(id);
            this.combos.update(prev => prev.filter(c => c.id !== id));
            this.toast.success('Combo eliminado');
        } catch {
            this.toast.error('Error al eliminar combo');
        }
    }

    // ─── CSV Import ───────────────────────────────────────────────────────────

    triggerImport(): void {
        this.csvPreview.set(null);
        this.csvFile = null;
        this.showCsvModal.set(true);
    }

    async onCsvFile(event: Event): Promise<void> {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        this.csvFile = file;
        const result = await this.svc.importProductsFromCSV(this.storeId, file, false);
        this.csvPreview.set(result);
    }

    async commitCsvImport(): Promise<void> {
        if (!this.csvFile) return;
        this.importing.set(true);
        try {
            const result = await this.svc.importProductsFromCSV(this.storeId, this.csvFile, true);
            this.toast.success(`✅ Importados ${result.inserted ?? 0} productos`);
            this.showCsvModal.set(false);
            this.reloadProducts();
        } catch {
            this.toast.error('Error durante la importación');
        } finally {
            this.importing.set(false);
        }
    }

    async exportCsv(): Promise<void> {
        try {
            await this.svc.exportCatalogToCSV(this.storeId);
        } catch {
            this.toast.error('Error al exportar');
        }
    }

    // ─── History ─────────────────────────────────────────────────────────────

    loadHistory(): void {
        this.historyLoading.set(true);
        this.svc.getCatalogChangeLog(this.storeId).subscribe({
            next: entries => {
                this.changeLog.set(entries);
                this.historyLoading.set(false);
            },
            error: () => this.historyLoading.set(false),
        });
    }

    // ─── Display helpers ──────────────────────────────────────────────────────

    modLabel(status: ModerationStatus): string { return MOD_LABELS[status] ?? status; }
    modColor(status: ModerationStatus): string { return MOD_COLORS[status] ?? ''; }
    stockIcon(p: CatalogProduct): string { return STOCK_LABELS[p.stock_status] ?? ''; }
    changeTypeLabel(type: string): string { return CHANGE_TYPE_LABELS[type] ?? type; }
}
