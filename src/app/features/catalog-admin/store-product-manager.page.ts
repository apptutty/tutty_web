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
  <span class="font-medium text-gray-800">{{ storeInfo()?.name ?? storeId }}</span>
</div>

<!-- ─── Store info card ──────────────────────────────────────────────────── -->
@if (storeInfo(); as store) {
  <div class="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-wrap items-center gap-4">
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <div class="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center text-2xl">
        @if (store.logo_url) {
          <img [src]="store.logo_url" class="w-full h-full object-cover" alt="" />
        } @else { 🏪 }
      </div>
      <div class="min-w-0">
        <p class="text-base font-bold text-gray-800">{{ store.name }}</p>
        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
          <span class="text-xs px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600">{{ store.commerce_type }}</span>
          <span class="text-xs font-medium" [class]="store.is_open ? 'text-success-600' : 'text-gray-400'">
            {{ store.is_open ? '● Abierto' : '○ Cerrado' }}
          </span>
          @if (!store.is_active) {
            <span class="text-xs px-1.5 py-0.5 bg-error-100 text-error-700 rounded-full font-medium">Inactivo</span>
          }
        </div>
      </div>
    </div>
    <!-- Stats -->
    <div class="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
      <div class="text-center"><p class="text-lg font-bold text-gray-800">{{ store.total_products }}</p><p>Productos</p></div>
      <div class="text-center"><p class="text-lg font-bold text-gray-800">{{ store.categories_count }}</p><p>Categorías</p></div>
      @if (store.pending_price_approval > 0) {
        <div class="text-center">
          <p class="text-lg font-bold text-warning-600">{{ store.pending_price_approval }}</p>
          <p class="text-warning-600">Precios pend.</p>
        </div>
      }
      @if (store.out_of_stock > 0) {
        <div class="text-center">
          <p class="text-lg font-bold text-error-600">{{ store.out_of_stock }}</p>
          <p class="text-error-600">Agotados</p>
        </div>
      }
    </div>
    <!-- Actions -->
    <div class="flex flex-wrap gap-2 flex-shrink-0">
      <a [routerLink]="['/catalog', storeId, 'products', 'new']"
         class="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nuevo producto
      </a>
      <button
        class="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors"
        (click)="triggerImport()"
      >📥 Importar CSV</button>
      <button
        class="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors"
        (click)="exportCsv()"
      >📤 Exportar CSV</button>
      <input #csvInput type="file" accept=".csv" class="hidden" (change)="onCsvFile($event)" />
    </div>
  </div>
}

<!-- ─── Tabs ───────────────────────────────────────────────────────────────── -->
<div class="border-b border-gray-200 mb-5">
  <nav class="flex gap-1">
    @for (tab of tabs; track tab.value) {
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        [class]="activeTab() === tab.value
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        (click)="activeTab.set(tab.value)"
      >
        {{ tab.label }}
        @if (tab.value === 'products' && pendingCount() > 0) {
          <span class="ml-1 px-1.5 py-0.5 bg-warning-500 text-white text-[10px] rounded-full font-bold">{{ pendingCount() }}</span>
        }
      </button>
    }
  </nav>
</div>

<!-- ════════════ TAB: PRODUCTOS ════════════════════════════════════════════════ -->
@if (activeTab() === 'products') {

  <!-- Toolbar -->
  <div class="flex flex-wrap items-center gap-2 mb-4">
    <div class="relative flex-1 min-w-[180px] max-w-sm">
      <svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
           fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
      </svg>
      <input type="search" class="input-field pl-8 text-sm" placeholder="Buscar producto…"
             [(ngModel)]="productSearch" (ngModelChange)="onProductSearch()" />
    </div>

    <select class="input-field text-sm w-40" [(ngModel)]="filterCategory" (ngModelChange)="reloadProducts()">
      <option value="">Todas las categorías</option>
      @for (cat of categories(); track cat.id) {
        <option [value]="cat.id">{{ cat.name }}</option>
      }
    </select>

    <select class="input-field text-sm w-36" [(ngModel)]="filterModeration" (ngModelChange)="reloadProducts(true)">
      <option value="all">Toda moderación</option>
      <option value="aprobado">✅ Aprobado</option>
      <option value="bajo_revision">⚠️ Bajo revisión</option>
      <option value="retirado">🔴 Retirado</option>
    </select>

    <select class="input-field text-sm w-36" [(ngModel)]="filterAvailability" (ngModelChange)="reloadProducts(true)">
      <option [ngValue]="null">Disponibilidad</option>
      <option [ngValue]="true">✅ Disponibles</option>
      <option [ngValue]="false">❌ No disponibles</option>
    </select>

    <select class="input-field text-sm w-32" [(ngModel)]="filterStockStatus" (ngModelChange)="reloadProducts(true)">
      <option value="all">Todo stock</option>
      <option value="disponible">Con stock</option>
      <option value="bajo_stock">⚠️ Bajo stock</option>
      <option value="agotado">🔴 Agotado</option>
      <option value="no_controlado">— No controlado</option>
    </select>

    <div class="flex items-center gap-1">
      <input type="number" class="input-field text-sm w-24" [(ngModel)]="filterMinPrice"
             (change)="reloadProducts(true)" placeholder="RD$ mín" min="0" />
      <span class="text-gray-300 text-xs">—</span>
      <input type="number" class="input-field text-sm w-24" [(ngModel)]="filterMaxPrice"
             (change)="reloadProducts(true)" placeholder="RD$ máx" min="0" />
    </div>

    <label class="flex items-center gap-1.5 text-xs text-warning-700 font-medium cursor-pointer">
      <input type="checkbox" class="rounded" [(ngModel)]="filterPending" (ngModelChange)="reloadProducts(true)" />
      Solo precios pendientes
    </label>

    @if (selectedIds().size > 0) {
      <div class="flex items-center gap-1.5 ml-auto">
        <span class="text-xs text-gray-500">{{ selectedIds().size }} seleccionados</span>
        <button class="btn-secondary text-xs py-1" (click)="bulkAvailability(true)">✅ Activar</button>
        <button class="btn-secondary text-xs py-1" (click)="bulkAvailability(false)">❌ Desactivar</button>
        <button class="btn-secondary text-xs py-1 text-warning-700" (click)="bulkModerateSel('retirado')">🚫 Retirar</button>
      </div>
    }

    <div class="ml-auto text-xs text-gray-400">{{ totalCount() }} productos</div>
  </div>

  <!-- Product table -->
  @if (productsLoading()) {
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
      @for (_ of [1,2,3,4,5]; track $index) {
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div class="w-4 h-4 bg-gray-100 rounded"></div>
          <div class="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0"></div>
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 bg-gray-100 rounded w-2/5"></div>
            <div class="h-3 bg-gray-100 rounded w-1/4"></div>
          </div>
          <div class="w-20 h-4 bg-gray-100 rounded"></div>
          <div class="w-20 h-4 bg-gray-100 rounded"></div>
          <div class="w-24 h-4 bg-gray-100 rounded"></div>
        </div>
      }
    </div>
  } @else {
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="w-10 px-4 py-2.5">
                <input type="checkbox" class="rounded" (change)="toggleSelectAll($event)" />
              </th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Precio</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Moderación</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Stock</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Disp.</th>
              <th class="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @for (p of products(); track p.id) {
              <tr
                class="hover:bg-gray-50 transition-colors"
                [class]="p.price_pending != null ? 'bg-warning-50/40' : ''"
              >
                <td class="px-4 py-3 text-center">
                  <input type="checkbox" class="rounded"
                         [checked]="selectedIds().has(p.id)"
                         (change)="toggleSelect(p.id, $event)" />
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      @if (p.photo_url) {
                        <img [src]="p.photo_url" class="w-full h-full object-cover" alt="" />
                      } @else {
                        <div class="w-full h-full flex items-center justify-center text-gray-300 text-xs">📷</div>
                      }
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium text-gray-800 truncate max-w-[200px]">{{ p.name }}</p>
                      @if (p.sku) { <p class="text-[10px] text-gray-400">SKU: {{ p.sku }}</p> }
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500">{{ p.category_name }}</td>
                <td class="px-4 py-3">
                  <p class="font-semibold text-gray-800">RD\${{ p.price | number:'1.0-0' }}</p>
                  @if (p.discount_price) {
                    <p class="text-[10px] text-success-600">Desc: RD\${{ p.discount_price | number:'1.0-0' }}</p>
                  }
                  @if (p.in_venue_price) {
                    <p class="text-[10px] text-gray-400">Sala: RD\${{ p.in_venue_price | number:'1.0-0' }}</p>
                  }
                </td>
                <td class="px-4 py-3">
                  @if (p.price_pending != null) {
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs font-bold text-warning-700">RD\${{ p.price_pending | number:'1.0-0' }}</span>
                      <span class="text-[10px] px-1 py-0.5 rounded bg-warning-100 text-warning-700 font-bold w-fit">
                        {{ p.price_change_pct! > 0 ? '+' : '' }}{{ p.price_change_pct }}%
                      </span>
                    </div>
                  } @else {
                    <span class="text-gray-300 text-xs">—</span>
                  }
                </td>
                <td class="px-4 py-3">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium" [class]="modColor(p.moderation_status)">
                    {{ modLabel(p.moderation_status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm">
                  {{ stockIcon(p) }}
                  @if (p.track_stock) { <span class="text-[10px] text-gray-400 ml-0.5">{{ p.stock_count ?? 0 }}</span> }
                </td>
                <td class="px-4 py-3">
                  <button
                    class="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                    [class]="p.is_available ? 'bg-success-400' : 'bg-gray-200'"
                    (click)="quickToggleAvailability(p)"
                  >
                    <span class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                          [style.left]="p.is_available ? '17px' : '2px'"></span>
                  </button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <a [routerLink]="['/catalog', storeId, 'products', p.id]"
                       class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Editar">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </a>
                    <button
                      class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Duplicar"
                      (click)="duplicateProduct(p)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    @if (p.price_pending != null) {
                      <button
                        class="p-1.5 rounded-lg hover:bg-warning-50 text-warning-500 transition-colors"
                        title="Revisar precio"
                        (click)="openPriceReview(p)"
                      >💰</button>
                    }
                    <button
                      class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Moderar"
                      (click)="openModerate(p)"
                    >🔍</button>
                    <button
                      class="p-1.5 rounded-lg hover:bg-error-50 text-gray-300 hover:text-error-500 transition-colors"
                      title="Eliminar"
                      (click)="deleteProduct(p)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            }
            @if (products().length === 0) {
              <tr>
                <td colspan="9" class="px-4 py-6">
                  <app-admin-empty-state
                    icon="search"
                    title="Sin productos para estos filtros"
                    description="Ajusta la búsqueda o cambia los filtros aplicados."
                    variant="soft" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      @if (totalCount() > pageSize) {
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p class="text-xs text-gray-500">{{ totalCount() }} resultados</p>
          <div class="flex items-center gap-2">
            <button class="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                    [disabled]="currentPage() === 1" (click)="goPage(currentPage() - 1)">← Ant</button>
            <span class="text-xs text-gray-500">{{ currentPage() }} / {{ totalPages() }}</span>
            <button class="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                    [disabled]="currentPage() === totalPages()" (click)="goPage(currentPage() + 1)">Sig →</button>
          </div>
        </div>
      }
    </div>
  }
}

<!-- ════════════ TAB: CATEGORÍAS ═══════════════════════════════════════════════ -->
@if (activeTab() === 'categories') {
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <p class="text-sm font-semibold text-gray-700">Categorías del catálogo</p>
      <button
        class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        (click)="addingCategory.set(!addingCategory())"
      >+ Nueva categoría</button>
    </div>

    @if (addingCategory()) {
      <div class="flex items-center gap-2 px-4 py-3 bg-primary-50 border-b border-primary-100">
        <input type="text" class="input-field text-sm flex-1" placeholder="Nombre de la categoría"
               [(ngModel)]="newCategoryName" (keydown.enter)="createCategory()" />
        <button class="btn-primary text-xs py-1.5" (click)="createCategory()" [disabled]="!newCategoryName.trim()">Crear</button>
        <button class="btn-secondary text-xs py-1.5" (click)="addingCategory.set(false)">Cancelar</button>
      </div>
    }

    <div class="divide-y divide-gray-100">
      @for (cat of categories(); track cat.id; let i = $index) {
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="text-gray-300 text-xs select-none cursor-grab">⠿</span>
          <div class="flex-1 min-w-0">
            @if (editingCatId() === cat.id) {
              <input type="text" class="input-field text-sm py-1" [(ngModel)]="editingCatName"
                     (keydown.enter)="saveCategoryEdit(cat)" (keydown.escape)="editingCatId.set(null)" />
            } @else {
              <p class="text-sm font-medium text-gray-700">{{ cat.name }}</p>
            }
          </div>
          <span class="text-xs text-gray-400 w-20 text-right">orden {{ cat.display_order }}</span>
          <label class="relative flex-shrink-0">
            <input type="checkbox" class="sr-only" [checked]="cat.is_active"
                   (change)="toggleCatActive(cat, $event)" />
            <div class="w-8 h-4 rounded-full transition-colors" [class]="cat.is_active ? 'bg-success-400' : 'bg-gray-200'"></div>
            <span class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                  [style.left]="cat.is_active ? '17px' : '2px'"></span>
          </label>
          <div class="flex items-center gap-1">
            @if (editingCatId() === cat.id) {
              <button class="text-xs px-2 py-1 bg-success-100 text-success-700 rounded" (click)="saveCategoryEdit(cat)">✓</button>
              <button class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded" (click)="editingCatId.set(null)">✕</button>
            } @else {
              <button class="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
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
    <p class="text-sm font-semibold text-gray-700">Combos del comercio</p>
    <button class="btn-primary text-sm" (click)="openComboForm()">+ Nuevo combo</button>
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
      <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
        <div class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          @if (combo.photo_url) {
            <img [src]="combo.photo_url" class="w-full h-full object-cover" alt="" />
          } @else { <div class="w-full h-full flex items-center justify-center text-xl">🎁</div> }
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-gray-800 truncate">{{ combo.name }}</p>
            <span class="text-sm font-bold text-primary-700 flex-shrink-0">RD\${{ combo.price | number:'1.0-0' }}</span>
          </div>
          @if (combo.description) {
            <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">{{ combo.description }}</p>
          }
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  [class]="combo.is_active ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'">
              {{ combo.is_active ? 'Activo' : 'Inactivo' }}
            </span>
            <div class="flex items-center gap-1 ml-auto">
              <button class="text-xs px-2 py-1 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                      (click)="openComboForm(combo)">✏️</button>
              <button class="text-xs px-2 py-1 hover:bg-error-50 rounded text-gray-400 hover:text-error-500 transition-colors"
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
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <p class="text-sm font-semibold text-gray-700">Historial de cambios</p>
      <p class="text-xs text-gray-400">Últimas 50 entradas</p>
    </div>

    @if (historyLoading()) {
      <div class="p-8 text-center text-gray-400 animate-pulse">Cargando historial…</div>
    } @else {
      <div class="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        @for (entry of changeLog(); track entry.id) {
          <div class="flex items-start gap-3 px-4 py-3">
            <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0 font-bold text-gray-500">
              {{ entry.changed_by_name.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold text-gray-700">{{ entry.changed_by_name }}</span>
                <span class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{{ changeTypeLabel(entry.change_type) }}</span>
                @if (entry.product_name) {
                  <span class="text-xs text-gray-500 truncate max-w-[200px]">{{ entry.product_name }}</span>
                }
              </div>
              @if (entry.notes) {
                <p class="text-xs text-gray-400 mt-0.5">{{ entry.notes }}</p>
              }
            </div>
            <span class="text-[10px] text-gray-400 flex-shrink-0">{{ entry.created_at | timeAgo }}</span>
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
    readonly totalCount = signal(0);
    readonly currentPage = signal(1);
    readonly pageSize = 30;
    readonly selectedIds = signal<Set<string>>(new Set());

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
    readonly pendingCount = computed(() => this.products().filter(p => p.price_pending != null).length);

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
            error: () => this.productsLoading.set(false),
        });
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
