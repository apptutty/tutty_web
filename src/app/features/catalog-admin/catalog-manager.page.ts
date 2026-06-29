import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    CatalogAdminService, StoreWithCatalogStats, PendingPriceItem, CatalogStoreFilters,
} from './services/catalog-admin.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

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

type CatalogStatusFilter = 'all' | 'open' | 'closed' | 'inactive';
type CatalogUpdateFilter = 'all' | 'month';
type CatalogSortFilter = 'recent' | 'active_desc';

@Component({
    selector: 'app-catalog-manager',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, TimeAgoPipe, AdminEmptyStateComponent],
    template: `
<section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_94%_12%,rgba(235,27,141,.12),transparent_25%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] px-6 py-5 mb-5">
  <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
    <div>
      <p class="inline-flex items-center rounded-full bg-[#ffe7f4] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#c71473]">
        Platform · Catalog Control
      </p>
      <h1 class="mt-2 text-[30px] leading-[1.08] tracking-[-0.04em] font-bold text-[#111827]">Gestión de Catálogos</h1>
      <p class="mt-2 max-w-4xl text-[15px] leading-6 text-[#667085]">
        Administra el catálogo de todos los comercios, revisa productos activos, categorías, precios pendientes y comercios con inventario agotado.
      </p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 xl:flex xl:flex-wrap xl:justify-end">
      <a routerLink="/catalog/search" class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-extrabold text-[#344054] hover:bg-[#f8fafc] transition-colors">
        Buscar producto
      </a>
      <a routerLink="/catalog/price-approvals" class="h-11 inline-flex items-center justify-center gap-1 rounded-2xl border border-[#ffd8a8] bg-[#fff6e6] px-4 text-sm font-extrabold text-[#b54708] hover:bg-[#ffefcf] transition-colors">
        💰 Precios pendientes
        @if (totalPending() > 0) {
          <span class="rounded-full bg-[#e46300] px-1.5 py-0.5 text-[10px] font-black text-white">{{ totalPending() }}</span>
        }
      </a>
    </div>
  </div>
</section>

<section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
  <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
    <div class="w-11 h-11 rounded-2xl bg-[#eef4ff] text-[#2451c7] grid place-items-center text-lg">🏪</div>
    <div>
      <p class="text-xs font-extrabold text-[#7b8496]">Comercios</p>
      <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ stores().length }}</p>
      <p class="text-xs text-[#98a2b3]">con catálogo publicado</p>
    </div>
  </article>
  <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
    <div class="w-11 h-11 rounded-2xl bg-[#eafbf1] text-[#087b3c] grid place-items-center text-lg">📦</div>
    <div>
      <p class="text-xs font-extrabold text-[#7b8496]">Productos activos</p>
      <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ totalActiveProducts() }}</p>
      <p class="text-xs text-[#98a2b3]">sincronizados hoy</p>
    </div>
  </article>
  <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
    <div class="w-11 h-11 rounded-2xl bg-[#fff6e6] text-[#e46300] grid place-items-center text-lg">💰</div>
    <div>
      <p class="text-xs font-extrabold text-[#7b8496]">Precios pendientes</p>
      <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ totalPending() }}</p>
      <p class="text-xs text-[#98a2b3]">requieren revisión</p>
    </div>
  </article>
  <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
    <div class="w-11 h-11 rounded-2xl bg-[#ffe7f4] text-[#c71473] grid place-items-center text-lg">🏷️</div>
    <div>
      <p class="text-xs font-extrabold text-[#7b8496]">Categorías</p>
      <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ totalCategories() }}</p>
      <p class="text-xs text-[#98a2b3]">en comercios activos</p>
    </div>
  </article>
</section>

<section class="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
  <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
    <div class="px-5 py-4 border-b border-[#eef1f6]">
      <h2 class="text-[16px] leading-tight tracking-[-0.02em] font-black text-[#111827]">Catálogo global</h2>
      <p class="mt-2 text-sm leading-5 text-[#667085]">Segmenta comercios por estado, tipo y alertas operativas.</p>
    </div>
    <div class="p-3">
      <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('all') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setQueueFilter('all')">
        <span class="inline-flex items-center gap-2"><span>🏪</span>Todos los comercios</span><span [class]="isQueueFilterActive('all') ? 'text-white/80' : 'text-[#98a2b3]'">{{ stores().length }}</span>
      </button>
      <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('open') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setQueueFilter('open')">
        <span class="inline-flex items-center gap-2"><span>✅</span>Abiertos</span><span [class]="isQueueFilterActive('open') ? 'text-white/80' : 'text-[#98a2b3]'">{{ openStoreCount() }}</span>
      </button>
      <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('pending') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setQueueFilter('pending')">
        <span class="inline-flex items-center gap-2"><span>💰</span>Precios pendientes</span><span [class]="isQueueFilterActive('pending') ? 'text-white/80' : 'text-[#98a2b3]'">{{ pendingStoreCount() }}</span>
      </button>
      <button type="button" class="w-full h-11 rounded-2xl px-3 mb-2 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('out') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setQueueFilter('out')">
        <span class="inline-flex items-center gap-2"><span>⚠️</span>Con agotados</span><span [class]="isQueueFilterActive('out') ? 'text-white/80' : 'text-[#98a2b3]'">{{ outOfStockStoreCount() }}</span>
      </button>
      <p class="mt-3 mb-2 px-2 text-[11px] tracking-[0.12em] uppercase text-[#98a2b3] font-black">Por tipo</p>
      <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isTypePanelActive('restaurante') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setTypePanelFilter('restaurante')">
        <span class="inline-flex items-center gap-2"><span>🍽️</span>Restaurantes</span><span [class]="isTypePanelActive('restaurante') ? 'text-white/80' : 'text-[#98a2b3]'">{{ typeStoreCount('restaurante') }}</span>
      </button>
      <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isTypePanelActive('bodega') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setTypePanelFilter('bodega')">
        <span class="inline-flex items-center gap-2"><span>📦</span>Bodegas</span><span [class]="isTypePanelActive('bodega') ? 'text-white/80' : 'text-[#98a2b3]'">{{ typeStoreCount('bodega') }}</span>
      </button>
      <button type="button" class="w-full h-11 rounded-2xl px-3 flex items-center justify-between text-left text-sm font-extrabold transition-colors" [class]="isTypePanelActive('market') ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setTypePanelFilter('market')">
        <span class="inline-flex items-center gap-2"><span>🛒</span>Market</span><span [class]="isTypePanelActive('market') ? 'text-white/80' : 'text-[#98a2b3]'">{{ marketStoreCount() }}</span>
      </button>
    </div>
  </aside>

  <div class="space-y-4 min-w-0">
    <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(260px,1fr)_auto_auto] gap-3 mb-3">
        <label class="h-12 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] px-3 inline-flex items-center gap-2 min-w-0">
          <span class="text-[#667085]">⌕</span>
          <input type="search" class="bg-transparent border-0 outline-0 min-w-0 w-full text-sm text-[#344054]" placeholder="Buscar comercio, categoría o producto..." [(ngModel)]="searchQuery" (ngModelChange)="onSearch()" aria-label="Buscar comercio, categoría o producto" />
        </label>
        <a routerLink="/catalog/search" class="h-12 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] px-4 text-sm font-extrabold text-[#344054] hover:bg-[#f8fafc] transition-colors">Buscar producto</a>
        <a routerLink="/catalog/price-approvals" class="h-12 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] px-4 text-sm font-extrabold text-[#344054] hover:bg-[#f8fafc] transition-colors">Precios pendientes</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        <select class="input-field text-sm !rounded-2xl !h-12" [(ngModel)]="filterType" (ngModelChange)="onTypeSelectChange()" aria-label="Todos los tipos">
          @for (ct of commerceTypes; track ct.value) {
            <option [value]="ct.value">{{ ct.label }}</option>
          }
        </select>
        <select class="input-field text-sm !rounded-2xl !h-12" [(ngModel)]="statusFilter" aria-label="Todos los estados">
          <option value="all">Todos los estados</option>
          <option value="open">Abierto</option>
          <option value="closed">Cerrado</option>
          <option value="inactive">Suspendido</option>
        </select>
        <select class="input-field text-sm !rounded-2xl !h-12" [(ngModel)]="updateFilter" aria-label="Actualizado recientemente">
          <option value="all">Actualizado recientemente</option>
          <option value="month">Actualizados este mes</option>
        </select>
        <select class="input-field text-sm !rounded-2xl !h-12" [(ngModel)]="sortFilter" aria-label="Más productos activos">
          <option value="recent">Actualizado recientemente</option>
          <option value="active_desc">Más productos activos</option>
        </select>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" class="h-9 inline-flex items-center gap-1 rounded-full border px-3 text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('all') && statusFilter === 'all' && updateFilter !== 'month' ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'" (click)="resetToAllChip()">Todos {{ stores().length }}</button>
        <button type="button" class="h-9 inline-flex items-center gap-1 rounded-full border px-3 text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('pending') ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setQueueFilter('pending')">Precios pendientes {{ pendingStoreCount() }}</button>
        <button type="button" class="h-9 inline-flex items-center gap-1 rounded-full border px-3 text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('out') ? 'bg-[#fee2e2] border-[#fecaca] text-[#b42318]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setQueueFilter('out')">Con agotados {{ outOfStockStoreCount() }}</button>
        <button type="button" class="h-9 inline-flex items-center gap-1 rounded-full border px-3 text-sm font-extrabold transition-colors" [class]="isQueueFilterActive('open') ? 'bg-[#eafbf1] border-[#a7f3c6] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setQueueFilter('open')">Abiertos {{ openStoreCount() }}</button>
        <button type="button" class="h-9 inline-flex items-center gap-1 rounded-full border px-3 text-sm font-extrabold transition-colors" [class]="updateFilter === 'month' ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'" (click)="toggleMonthQuickFilter()">Actualizados este mes</button>
      </div>
    </section>

    @if (pendingItems().length > 0) {
      <section class="rounded-3xl border border-[#ffd8a8] bg-[#fffdf7] shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#ffe7c2]">
          <h3 class="text-sm font-black text-[#b54708]">Precios pendientes</h3>
          <a routerLink="/catalog/price-approvals" class="text-xs font-bold text-[#b54708] hover:underline">Ver todos</a>
        </div>
        <div class="divide-y divide-[#f4efe6]">
          @for (item of pendingItems().slice(0, 3); track item.product_id) {
            <div class="px-4 py-3 flex items-center gap-3">
              <p class="text-xs text-[#667085] min-w-0 flex-1 truncate"><strong>{{ item.store_name }}</strong> · {{ item.product_name }}</p>
              <button class="px-2 py-1 rounded-lg bg-[#eafbf1] text-[#087b3c] text-xs font-bold" (click)="quickApprove(item)" [disabled]="approving() === item.product_id">Aprobar</button>
              <button class="px-2 py-1 rounded-lg bg-[#fee2e2] text-[#b42318] text-xs font-bold" (click)="openRejectModal(item)">Rechazar</button>
            </div>
          }
        </div>
      </section>
    }

    <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
      <div class="px-5 py-4 border-b border-[#eef1f6] flex items-center justify-between gap-3">
        <div>
          <h3 class="text-[16px] leading-tight tracking-[-0.02em] font-black text-[#111827]">Comercios con catálogo</h3>
          <p class="mt-1 text-sm font-bold text-[#98a2b3]">{{ visibleStores().length }} comercios encontrados</p>
        </div>
        <button type="button" class="h-11 rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-extrabold text-[#344054]">Vista tarjetas</button>
      </div>

      @if (loading()) {
        <div class="p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          @for (_ of [1,2,3,4,5,6]; track $index) {
            <div class="rounded-[20px] border border-[#e7eaf1] p-4 animate-pulse">
              <div class="h-5 w-1/2 rounded bg-gray-100 mb-3"></div>
              <div class="h-3 w-2/3 rounded bg-gray-100 mb-2"></div>
              <div class="h-3 w-1/3 rounded bg-gray-100 mb-4"></div>
              <div class="h-8 rounded-xl bg-gray-100"></div>
            </div>
          }
        </div>
      }

      @if (!loading() && loadError()) {
        <div class="px-5 py-10">
          <app-admin-empty-state icon="default" title="No se pudo cargar el catálogo" description="Intenta refrescar la página o vuelve a intentarlo más tarde." variant="soft">
          </app-admin-empty-state>
          <div class="mt-3 flex justify-center">
            <button type="button" class="h-10 rounded-xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="load()">Reintentar</button>
          </div>
        </div>
      }

      @if (!loading() && !loadError() && visibleStores().length === 0) {
        <div class="px-5 py-10">
          <app-admin-empty-state
            icon="search"
            [title]="hasActiveFilters() ? 'No hay comercios para estos filtros' : 'No hay catálogos disponibles'"
            [description]="hasActiveFilters() ? 'Prueba cambiando la búsqueda, el tipo de comercio o las alertas activas.' : 'Los comercios con productos publicados aparecerán aquí.'"
            variant="soft" />
        </div>
      }

      @if (!loading() && !loadError() && visibleStores().length > 0) {
        <div class="p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          @for (store of visibleStores(); track store.id) {
            <article class="rounded-[20px] border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(18,24,40,.11)]"
                     [class]="store.pending_price_approval > 0 || store.out_of_stock > 0 ? 'border-[#ffc2e2] hover:border-[#ff9fd2]' : 'border-[#e7eaf1]'">
              <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-12 h-12 rounded-2xl bg-[#f4f6f9] overflow-hidden grid place-items-center text-xl flex-shrink-0">
                    @if (store.logo_url) {
                      <img [src]="store.logo_url" class="w-full h-full object-cover" alt="" />
                    } @else {
                      {{ commerceIcon(store.commerce_type) }}
                    }
                  </div>
                  <div class="min-w-0">
                    <h4 class="text-[15px] leading-tight tracking-[-0.01em] font-black text-[#111827] truncate">{{ store.name }}</h4>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      <span class="inline-flex items-center rounded-full bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-black text-[#667085]">{{ commerceLabel(store.commerce_type) }}</span>
                      <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black"
                            [class]="!store.is_active ? 'bg-[#fee2e2] text-[#b42318]' : (store.is_open ? 'bg-[#eafbf1] text-[#087b3c]' : 'bg-[#f4f6f9] text-[#667085]')">
                        {{ !store.is_active ? 'Suspendido' : (store.is_open ? 'Abierto' : 'Cerrado') }}
                      </span>
                      @if (store.pending_price_approval > 0) {
                        <span class="inline-flex items-center rounded-full bg-[#fff6e6] px-2.5 py-1 text-[11px] font-black text-[#b54708]">Precio pendiente</span>
                      }
                      @if (store.out_of_stock > 0) {
                        <span class="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-1 text-[11px] font-black text-[#b42318]">Agotados</span>
                      }
                    </div>
                  </div>
                </div>
                <button type="button" class="w-9 h-9 rounded-xl border border-[#e7eaf1] text-[#667085] bg-white" aria-label="Menú de acciones del comercio">⋯</button>
              </div>

              <div class="border-y border-[#eef1f6] py-3 mb-3 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-bold text-[#667085]">📦 Productos activos</span>
                  <strong class="text-[#111827]">{{ store.active_products }} / {{ store.total_products }}</strong>
                </div>
                <div class="h-2 rounded-full bg-[#f1f3f7] overflow-hidden" role="progressbar" [attr.aria-label]="'Cobertura de productos activos de ' + store.name" [attr.aria-valuemin]="0" [attr.aria-valuemax]="100" [attr.aria-valuenow]="productCoverage(store)">
                  <div class="h-full rounded-full bg-[linear-gradient(90deg,#eb1b8d,#ff73bd)]" [style.width.%]="productCoverage(store)"></div>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="font-bold text-[#667085]">🏷️ Categorías</span>
                  <strong class="text-[#111827]">{{ store.categories_count }}</strong>
                </div>
              </div>

              <p class="text-xs text-[#98a2b3] mb-3">Actualizado {{ store.last_catalog_update | timeAgo }}</p>
              <div class="grid grid-cols-[1fr_auto] gap-2">
                <a [routerLink]="['/catalog', store.id]" class="h-10 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white text-sm font-black text-[#111827] hover:bg-[#f8fafc] transition-colors">
                  Gestionar catálogo →
                </a>
                <a routerLink="/catalog/search" class="w-10 h-10 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] text-[#667085]" aria-label="Buscar producto en catálogo">
                  ⌕
                </a>
              </div>
            </article>
          }
        </div>
      }
    </section>
  </div>
</section>

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

    readonly stores = signal<StoreWithCatalogStats[]>([]);
    readonly pendingItems = signal<PendingPriceItem[]>([]);
    readonly loading = signal(true);
    readonly loadError = signal(false);
    readonly approving = signal<string | null>(null);
    readonly rejecting = signal(false);
    readonly rejectingItem = signal<PendingPriceItem | null>(null);

    readonly totalPending = computed(() => this.pendingItems().length);
    readonly totalActiveProducts = computed(() =>
        this.stores().reduce((sum, store) => sum + store.active_products, 0)
    );
    readonly totalCategories = computed(() =>
        this.stores().reduce((sum, store) => sum + store.categories_count, 0)
    );
    readonly openStoreCount = computed(() =>
        this.stores().filter(store => store.is_active && store.is_open).length
    );
    readonly visibleStores = computed(() => {
        let items = [...this.stores()];

        if (this.marketTypeActive) {
            items = items.filter(store => store.commerce_type === 'supermercado' || store.commerce_type === 'colmado');
        }

        if (this.statusFilter === 'open') {
            items = items.filter(store => store.is_active && store.is_open);
        } else if (this.statusFilter === 'closed') {
            items = items.filter(store => store.is_active && !store.is_open);
        } else if (this.statusFilter === 'inactive') {
            items = items.filter(store => !store.is_active);
        }

        if (this.updateFilter === 'month') {
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            items = items.filter(store => new Date(store.last_catalog_update) >= monthAgo);
        }

        if (this.sortFilter === 'active_desc') {
            items.sort((a, b) => b.active_products - a.active_products);
        } else {
            items.sort((a, b) => new Date(b.last_catalog_update).getTime() - new Date(a.last_catalog_update).getTime());
        }

        return items;
    });

    // ── Filters ───────────────────────────────────────────────────────────────

    searchQuery = '';
    filterType = '';
    filterPendingPrices = false;
    filterOutOfStock = false;
    statusFilter: CatalogStatusFilter = 'all';
    updateFilter: CatalogUpdateFilter = 'all';
    sortFilter: CatalogSortFilter = 'recent';
    queueFilter: 'all' | 'open' | 'pending' | 'out' = 'all';
    marketTypeActive = false;

    readonly commerceTypes = COMMERCE_TYPES;

    private searchTimeout: ReturnType<typeof setTimeout> | null = null;
    rejectReason = '';

    ngOnInit(): void {
        this.load();
        this.loadPending();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(false);
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
            error: () => {
                this.loading.set(false);
                this.loadError.set(true);
            },
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

    hasActiveFilters(): boolean {
        return Boolean(
            this.searchQuery.trim() ||
            this.filterType ||
            this.filterPendingPrices ||
            this.filterOutOfStock ||
            this.statusFilter !== 'all' ||
            this.updateFilter !== 'all' ||
            this.marketTypeActive
        );
    }

    pendingStoreCount(): number {
        return this.stores().filter(s => (s.pending_price_approval ?? 0) > 0).length;
    }

    outOfStockStoreCount(): number {
        return this.stores().filter(s => (s.out_of_stock ?? 0) > 0).length;
    }

    typeStoreCount(type: string): number {
        return this.stores().filter(s => s.commerce_type === type).length;
    }

    marketStoreCount(): number {
        return this.stores().filter(s => s.commerce_type === 'supermercado' || s.commerce_type === 'colmado').length;
    }

    isQueueFilterActive(mode: 'all' | 'open' | 'pending' | 'out'): boolean {
        return this.queueFilter === mode;
    }

    setQueueFilter(mode: 'all' | 'open' | 'pending' | 'out'): void {
        this.queueFilter = mode;
        this.filterPendingPrices = mode === 'pending';
        this.filterOutOfStock = mode === 'out';
        this.statusFilter = mode === 'open' ? 'open' : 'all';
        this.load();
    }

    isTypePanelActive(mode: 'restaurante' | 'bodega' | 'market'): boolean {
        if (mode === 'market') return this.marketTypeActive;
        return this.filterType === mode && !this.marketTypeActive;
    }

    setTypePanelFilter(mode: 'restaurante' | 'bodega' | 'market'): void {
        if (mode === 'market') {
            this.marketTypeActive = !this.marketTypeActive;
            this.filterType = '';
            this.load();
            return;
        }

        this.marketTypeActive = false;
        this.filterType = this.filterType === mode ? '' : mode;
        this.load();
    }

    onTypeSelectChange(): void {
        this.marketTypeActive = false;
        this.load();
    }

    resetToAllChip(): void {
        this.queueFilter = 'all';
        this.filterPendingPrices = false;
        this.filterOutOfStock = false;
        this.statusFilter = 'all';
        this.updateFilter = 'all';
        this.marketTypeActive = false;
        this.filterType = '';
        this.load();
    }

    toggleMonthQuickFilter(): void {
        this.updateFilter = this.updateFilter === 'month' ? 'all' : 'month';
    }

    productCoverage(store: StoreWithCatalogStats): number {
        if (!store.total_products) return 0;
        return Math.round((store.active_products / store.total_products) * 100);
    }

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
