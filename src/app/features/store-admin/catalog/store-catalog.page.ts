import {
    Component,
    OnInit,
    OnDestroy,
    signal,
    computed,
    inject,
    effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StoreAdminService } from '../store-admin.service';
import { StoreCatalogService } from './store-catalog.service';
import { ProductCardComponent } from './product-card.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/modal/confirm.service';
import { MenuItem, MenuCategory } from '../../../core/supabase/database.types';

@Component({
    selector: 'app-store-catalog',
    standalone: true,
    imports: [CommonModule, FormsModule, ProductCardComponent],
    styles: [`
    .cat-item { transition: background 0.12s, color 0.12s; }
    .cat-item:hover { background: #fdf2f8; }
    .cat-item.active { background: #fce7f3; color: #9d174d; }
    .chip { display:inline-flex; align-items:center; padding: 4px 12px; border-radius:99px; font-size:0.75rem; cursor:pointer; border:1px solid #e5e7eb; transition: all 0.15s; }
    .chip.on { background:#e91e8c; color:white; border-color:#e91e8c; }
    .chip:not(.on):hover { background:#f9fafb; }
  `],
    template: `
  <div class="flex h-full overflow-hidden" style="min-height:calc(100vh - 64px)">

    <!-- ─── LEFT: Categories Panel ─────────────────────────────── -->
    <aside class="w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div class="p-4 border-b border-gray-100">
        <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categorías</h2>
      </div>

      <!-- All category -->
      <button
        class="cat-item flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 w-full text-left"
        [class.active]="selectedCategoryId() === null"
        (click)="selectCategory(null)">
        <span>Todos los productos</span>
        <span class="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{{ allProducts().length }}</span>
      </button>

      <!-- Category list -->
      @for (cat of categories(); track cat.id; let i = $index) {
        <div class="cat-item flex items-center gap-1 px-2 py-1.5"
          [class.active]="selectedCategoryId() === cat.id">
          <!-- Up/Down reorder -->
          <div class="flex flex-col gap-0 flex-shrink-0">
            <button (click)="moveCategory(i, -1)" [disabled]="i === 0"
              class="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
            </button>
            <button (click)="moveCategory(i, 1)" [disabled]="i === categories().length - 1"
              class="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
          </div>

          <!-- Name click -->
          <button class="flex-1 text-left text-sm font-medium truncate" (click)="selectCategory(cat.id)">
            {{ cat.name }}
          </button>

          <!-- Count -->
          <span class="text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {{ productCountByCategory()[cat.id] }}
          </span>

          <!-- Active toggle -->
          <button (click)="toggleCategory(cat)"
            [title]="cat.is_active ? 'Desactivar' : 'Activar'"
            class="flex-shrink-0 p-1 rounded transition-colors"
            [class]="cat.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100'">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="5" />
            </svg>
          </button>

          <!-- Delete -->
          <button (click)="deleteCategory(cat)"
            class="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }

      <!-- Add category -->
      <div class="p-3 border-t border-gray-100 mt-auto">
        @if (addingCategory()) {
          <div class="flex gap-1">
            <input [(ngModel)]="newCategoryName" (keyup.enter)="saveNewCategory()"
              placeholder="Nombre de categoría"
              class="input-field flex-1 text-sm py-1.5" #catInput autofocus />
            <button (click)="saveNewCategory()" class="btn-primary px-3 py-1.5 text-sm">OK</button>
            <button (click)="addingCategory.set(false)" class="px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm">✕</button>
          </div>
        } @else {
          <button (click)="addingCategory.set(true)"
            class="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-lg px-3 py-2 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva categoría
          </button>
        }
      </div>
    </aside>

    <!-- ─── RIGHT: Products Panel ───────────────────────────────── -->
    <main class="flex-1 flex flex-col overflow-hidden bg-gray-50">

      <!-- Top bar -->
      <div class="bg-white border-b border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <h1 class="text-lg font-bold text-gray-900 mr-2">{{ catalogTitle() }}</h1>

        <!-- Search -->
        <div class="relative flex-1 min-w-48">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.804 7.5 7.5 0 0 0 15.803 15.803Z"/>
          </svg>
          <input [(ngModel)]="searchQuery" placeholder="Buscar producto..."
            class="input-field pl-9 pr-3 py-2 text-sm w-full" />
        </div>

        <!-- Filter chips -->
        <div class="flex items-center gap-2 flex-wrap">
          <button class="chip" [class.on]="fAvailable()" (click)="toggleFilter('available')">Disponible</button>
          <button class="chip" [class.on]="fOutOfStock()" (click)="toggleFilter('outOfStock')">Sin stock</button>
          <button class="chip" [class.on]="fDiscounted()" (click)="toggleFilter('discounted')">Con descuento</button>
          <button class="chip" [class.on]="fFeatured()" (click)="toggleFilter('featured')">Destacados</button>
        </div>

        <!-- View toggle -->
        <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button (click)="viewMode.set('grid')" [class.bg-gray-100]="viewMode() === 'grid'"
            class="p-2 transition-colors" title="Cuadrícula">
            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
          <button (click)="viewMode.set('list')" [class.bg-gray-100]="viewMode() === 'list'"
            class="p-2 transition-colors" title="Lista">
            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </button>
        </div>

        <!-- Actions -->
        <button (click)="showBulkImport.set(true)"
          class="btn-secondary flex items-center gap-2 text-sm py-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          CSV
        </button>
        <button (click)="newProduct()"
          class="btn-primary flex items-center gap-2 text-sm py-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo producto
        </button>
      </div>

      <!-- Products area -->
      <div class="flex-1 overflow-y-auto p-4">
        @if (isLoading()) {
          <div class="flex justify-center py-16">
            <div class="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
          </div>
        } @else if (filteredProducts().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.804 7.5 7.5 0 0 0 15.803 15.803Z" />
            </svg>
            <p class="font-medium">No hay productos</p>
            <p class="text-sm mt-1">Agrega un producto para comenzar</p>
          </div>
        } @else if (viewMode() === 'grid') {
          <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (product of filteredProducts(); track product.id) {
              <app-product-card
                [product]="product"
                [commerceType]="commerceType()"
                [categoryName]="categoryNameMap()[product.category_id ?? '']"
                (toggleAvailability)="onToggleAvailability($event)"
                (editProduct)="editProduct($event)"
                (deleteProduct)="onDeleteProduct($event)" />
            }
          </div>
        } @else {
          <!-- List view -->
          <div class="card overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th class="px-4 py-3 text-left">Producto</th>
                  <th class="px-4 py-3 text-left hidden lg:table-cell">Categoría</th>
                  <th class="px-4 py-3 text-right">Precio</th>
                  <th class="px-4 py-3 text-center">Disponible</th>
                  <th class="px-4 py-3 text-center hidden md:table-cell">Stock</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (p of filteredProducts(); track p.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        @if (p.photo_url) {
                          <img [src]="p.photo_url" class="w-10 h-10 rounded-lg object-cover flex-shrink-0" [alt]="p.name" />
                        } @else {
                          <div class="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0"></div>
                        }
                        <div>
                          <p class="font-medium text-gray-900">{{ p.name }}</p>
                          @if (p.sku) { <p class="text-xs text-gray-400">SKU: {{ p.sku }}</p> }
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {{ categoryNameMap()[p.category_id ?? ''] ?? '—' }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div>
                        <span class="font-semibold">\${{ (p.discount_price ?? p.price) | number:'1.2-2' }}</span>
                        @if (p.discount_price) {
                          <span class="block text-xs text-gray-400 line-through">\${{ p.price | number:'1.2-2' }}</span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span [class]="p.is_available ? 'text-green-600' : 'text-gray-400'">
                        {{ p.is_available ? 'Sí' : 'No' }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-center hidden md:table-cell">
                      @if (p.track_stock) {
                        <span [class]="(p.stock_count ?? 0) === 0 ? 'text-red-600 font-semibold' : 'text-gray-700'">
                          {{ p.stock_count ?? 0 }}
                        </span>
                      } @else {
                        <span class="text-gray-400">—</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button (click)="onToggleAvailability({ id: p.id, val: !p.is_available })"
                          class="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          [title]="p.is_available ? 'Desactivar' : 'Activar'">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        </button>
                        <button (click)="editProduct(p.id)"
                          class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                        </button>
                        <button (click)="onDeleteProduct(p.id)"
                          class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </main>
  </div>

  <!-- ─── Bulk Import Modal ────────────────────────────────────── -->
  @if (showBulkImport()) {
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="showBulkImport.set(false)">
      <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-900">Importar productos desde CSV</h2>
          <button (click)="showBulkImport.set(false)" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Step 1: Download template -->
        <div class="mb-4 p-3 bg-blue-50 rounded-xl text-sm">
          <p class="font-medium text-blue-800 mb-1">Paso 1: Descarga la plantilla</p>
          <button (click)="downloadCsvTemplate()"
            class="text-blue-600 hover:underline flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Descargar plantilla.csv
          </button>
        </div>

        <!-- Step 2: Upload file -->
        <div class="mb-4">
          <p class="text-sm font-medium text-gray-700 mb-2">Paso 2: Sube tu archivo CSV</p>
          <input type="file" accept=".csv,text/csv" (change)="onCsvFileSelected($event)"
            class="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-pink-50 file:text-pink-700 file:font-medium hover:file:bg-pink-100 cursor-pointer" />
        </div>

        <!-- Preview -->
        @if (csvPreviewRows().length > 0) {
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Vista previa (primeras 5 filas)</p>
            <div class="overflow-x-auto border border-gray-200 rounded-lg text-xs">
              <table class="w-full">
                <thead class="bg-gray-50 text-gray-500">
                  <tr>
                    @for (h of csvHeaders(); track h) {
                      <th class="px-2 py-1.5 text-left font-medium">{{ h }}</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (row of csvPreviewRows(); track $index) {
                    <tr>
                      @for (h of csvHeaders(); track h) {
                        <td class="px-2 py-1.5">{{ row[h] }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-500 mt-1">Total a importar: {{ csvAllRows().length }} productos</p>
          </div>
        }

        @if (csvErrors().length > 0) {
          <div class="mb-4 p-3 bg-red-50 rounded-xl text-xs text-red-700 space-y-0.5">
            @for (e of csvErrors(); track $index) { <p>{{ e }}</p> }
          </div>
        }

        <div class="flex justify-end gap-2">
          <button (click)="showBulkImport.set(false)" class="btn-secondary text-sm">Cancelar</button>
          <button (click)="runBulkImport()"
            [disabled]="csvAllRows().length === 0 || importingCsv()"
            class="btn-primary text-sm disabled:opacity-50">
            @if (importingCsv()) { Importando... } @else { Importar {{ csvAllRows().length }} productos }
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class StoreCatalogPageComponent implements OnInit, OnDestroy {
    private readonly storeService = inject(StoreAdminService);
    private readonly catalogService = inject(StoreCatalogService);
    private readonly toast = inject(ToastService);
    private readonly confirmSvc = inject(ConfirmService);
    private readonly router = inject(Router);
    private sub?: Subscription;

    // ─── State ────────────────────────────────────────────────────────────────
    readonly categories = signal<MenuCategory[]>([]);
    readonly allProducts = signal<MenuItem[]>([]);
    readonly isLoading = signal(false);
    readonly selectedCategoryId = signal<string | null>(null);
    readonly viewMode = signal<'grid' | 'list'>('grid');

    // Filters
    readonly fAvailable = signal(false);
    readonly fOutOfStock = signal(false);
    readonly fDiscounted = signal(false);
    readonly fFeatured = signal(false);

    searchQuery = '';

    // Add category
    readonly addingCategory = signal(false);
    newCategoryName = '';

    // Bulk import
    readonly showBulkImport = signal(false);
    readonly csvHeaders = signal<string[]>([]);
    readonly csvAllRows = signal<Record<string, string>[]>([]);
    readonly csvPreviewRows = signal<Record<string, string>[]>([]);
    readonly csvErrors = signal<string[]>([]);
    readonly importingCsv = signal(false);

    // ─── Computed ─────────────────────────────────────────────────────────────
    readonly commerceType = computed(() => this.storeService.activeStore()?.commerce_type ?? 'otro');

    readonly catalogTitle = computed(() => {
        const type = this.commerceType();
        if (type === 'restaurante') return 'Mi Menú';
        if (type === 'farmacia') return 'Mis Productos';
        return 'Mi Catálogo';
    });

    readonly categoryNameMap = computed(() => {
        const map: Record<string, string> = {};
        for (const c of this.categories()) map[c.id] = c.name;
        return map;
    });

    readonly productCountByCategory = computed(() => {
        const map: Record<string, number> = {};
        for (const p of this.allProducts()) {
            const k = p.category_id ?? '__none__';
            map[k] = (map[k] ?? 0) + 1;
        }
        return map;
    });

    readonly filteredProducts = computed(() => {
        const q = this.searchQuery.toLowerCase().trim();
        const catId = this.selectedCategoryId();
        const avail = this.fAvailable();
        const oos = this.fOutOfStock();
        const disc = this.fDiscounted();
        const feat = this.fFeatured();

        return this.allProducts().filter(p => {
            if (catId && p.category_id !== catId) return false;
            if (q && !p.name.toLowerCase().includes(q)) return false;
            if (avail && !p.is_available) return false;
            if (oos && (p.stock_count ?? 1) > 0) return false;
            if (disc && !p.discount_price) return false;
            if (feat && !p.is_featured) return false;
            return true;
        });
    });

    constructor() {
        effect(() => {
            const storeId = this.storeService.activeStoreId();
            if (storeId) this.loadData(storeId);
        });
    }

    ngOnInit() { }
    ngOnDestroy() { this.sub?.unsubscribe(); }

    // ─── Data loading ─────────────────────────────────────────────────────────
    private loadData(storeId: string) {
        this.isLoading.set(true);
        this.sub?.unsubscribe();

        let catsLoaded = false;
        let prodsLoaded = false;
        const checkDone = () => { if (catsLoaded && prodsLoaded) this.isLoading.set(false); };

        this.catalogService.getCategories(storeId).subscribe({
            next: cats => { this.categories.set(cats); catsLoaded = true; checkDone(); },
            error: () => { catsLoaded = true; checkDone(); },
        });

        this.catalogService.getProducts(storeId).subscribe({
            next: prods => { this.allProducts.set(prods); prodsLoaded = true; checkDone(); },
            error: () => { prodsLoaded = true; checkDone(); },
        });
    }

    // ─── Category actions ─────────────────────────────────────────────────────
    selectCategory(id: string | null) {
        this.selectedCategoryId.set(id);
    }

    async moveCategory(index: number, dir: -1 | 1) {
        const cats = [...this.categories()];
        const target = index + dir;
        if (target < 0 || target >= cats.length) return;
        [cats[index], cats[target]] = [cats[target], cats[index]];
        const reordered = cats.map((c, i) => ({ ...c, display_order: i }));
        this.categories.set(reordered);
        try {
            await this.catalogService.reorderCategories(
                reordered.map(c => ({ id: c.id, display_order: c.display_order })),
            );
        } catch {
            this.toast.error('Error al reordenar categorías');
        }
    }

    async toggleCategory(cat: MenuCategory) {
        const updated = { ...cat, is_active: !cat.is_active };
        this.categories.update(list => list.map(c => (c.id === cat.id ? updated : c)));
        try {
            await this.catalogService.updateCategory(cat.id, { is_active: updated.is_active });
        } catch {
            this.categories.update(list => list.map(c => (c.id === cat.id ? cat : c)));
            this.toast.error('Error al actualizar categoría');
        }
    }

    async saveNewCategory() {
        const name = this.newCategoryName.trim();
        const storeId = this.storeService.activeStoreId();
        if (!name || !storeId) return;
        try {
            const cat = await this.catalogService.createCategory(storeId, name);
            this.categories.update(list => [...list, cat]);
            this.newCategoryName = '';
            this.addingCategory.set(false);
            this.toast.success('Categoría creada');
        } catch {
            this.toast.error('Error al crear categoría');
        }
    }

    async deleteCategory(cat: MenuCategory) {
        const ok = await this.confirmSvc.confirm({
            title: 'Eliminar categoría',
            message: `¿Eliminar categoría "${cat.name}"? Los productos quedarán sin categoría.`,
            danger: true,
        });
        if (!ok) return;
        try {
            await this.catalogService.updateCategory(cat.id, { is_active: false });
            this.categories.update(list => list.filter(c => c.id !== cat.id));
            this.toast.success('Categoría eliminada');
        } catch {
            this.toast.error('Error al eliminar categoría');
        }
    }

    // ─── Filter chips ─────────────────────────────────────────────────────────
    toggleFilter(key: 'available' | 'outOfStock' | 'discounted' | 'featured') {
        if (key === 'available') this.fAvailable.update(v => !v);
        else if (key === 'outOfStock') this.fOutOfStock.update(v => !v);
        else if (key === 'discounted') this.fDiscounted.update(v => !v);
        else this.fFeatured.update(v => !v);
    }

    // ─── Product actions ──────────────────────────────────────────────────────
    newProduct() {
        this.router.navigate(['/store/catalog/new']);
    }

    editProduct(id: string) {
        this.router.navigate(['/store/catalog', id]);
    }

    async onToggleAvailability(ev: { id: string; val: boolean }) {
        this.allProducts.update(list =>
            list.map(p => (p.id === ev.id ? { ...p, is_available: ev.val } : p)),
        );
        try {
            await this.catalogService.toggleProductAvailability(ev.id, ev.val);
        } catch {
            this.allProducts.update(list =>
                list.map(p => (p.id === ev.id ? { ...p, is_available: !ev.val } : p)),
            );
            this.toast.error('Error al actualizar disponibilidad');
        }
    }

    async onDeleteProduct(id: string) {
        const prod = this.allProducts().find(p => p.id === id);
        const ok = await this.confirmSvc.confirm({
            title: 'Eliminar producto',
            message: `¿Eliminar "${prod?.name ?? 'este producto'}"? Esta acción no se puede deshacer.`,
            danger: true,
        });
        if (!ok) return;
        try {
            await this.catalogService.deleteProduct(id);
            this.allProducts.update(list => list.filter(p => p.id !== id));
            this.toast.success('Producto eliminado');
        } catch {
            this.toast.error('Error al eliminar producto');
        }
    }

    // ─── CSV Import ───────────────────────────────────────────────────────────
    downloadCsvTemplate() {
        const type = this.commerceType();
        let headers = ['name', 'description', 'price', 'discount_price', 'category_name', 'is_available', 'is_featured', 'tags'];

        if (type === 'restaurante') headers = [...headers, 'preparation_time', 'calories', 'is_combo'];
        else if (type === 'farmacia') headers = [...headers, 'brand', 'sku', 'barcode', 'unit_type', 'requires_prescription'];
        else if (['bodega', 'colmado', 'supermercado'].includes(type)) headers = [...headers, 'brand', 'sku', 'barcode', 'unit_type'];
        else if (['tienda_ropa', 'electronica'].includes(type)) headers = [...headers, 'sku', 'has_variants'];

        const csv = headers.join(',') + '\nEjemplo producto,Descripción,10.99,,Mi categoría,true,false,';
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'plantilla_productos.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    onCsvFileSelected(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = (e.target?.result as string) ?? '';
            this.parseCsv(text);
        };
        reader.readAsText(file);
    }

    private parseCsv(text: string) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { this.toast.warning('El CSV está vacío'); return; }
        const headers = lines[0].split(',').map(h => h.trim());
        this.csvHeaders.set(headers);
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => (row[h] = cols[idx] ?? ''));
            rows.push(row);
        }
        this.csvAllRows.set(rows);
        this.csvPreviewRows.set(rows.slice(0, 5));
        this.csvErrors.set([]);
    }

    async runBulkImport() {
        const storeId = this.storeService.activeStoreId();
        if (!storeId || this.csvAllRows().length === 0) return;
        this.importingCsv.set(true);
        const mapped = this.csvAllRows().map(row => ({
            name: row['name'],
            description: row['description'] || undefined,
            price: parseFloat(row['price']) || 0,
            discount_price: row['discount_price'] ? parseFloat(row['discount_price']) : undefined,
            is_available: row['is_available'] !== 'false',
            is_featured: row['is_featured'] === 'true',
            tags: row['tags'] ? row['tags'].split('|') : [],
            preparation_time: row['preparation_time'] ? parseInt(row['preparation_time']) : undefined,
            calories: row['calories'] ? parseInt(row['calories']) : undefined,
            sku: row['sku'] || undefined,
            brand: row['brand'] || undefined,
        } as Parameters<typeof this.catalogService.bulkImport>[1][number]));

        try {
            const result = await this.catalogService.bulkImport(storeId, mapped);
            this.toast.success(`${result.success} productos importados correctamente`);
            if (result.errors.length) this.csvErrors.set(result.errors);
            // Reload products
            this.catalogService.getProducts(storeId).subscribe(p => this.allProducts.set(p));
            if (result.errors.length === 0) this.showBulkImport.set(false);
        } catch (err) {
            this.toast.error('Error al importar productos');
        } finally {
            this.importingCsv.set(false);
        }
    }
}
