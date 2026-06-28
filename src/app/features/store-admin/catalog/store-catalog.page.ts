import {
    Component,
    OnInit,
    OnDestroy,
    signal,
    computed,
    inject,
    effect,
    ViewChild,
    ElementRef,
    HostListener,
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
import { MenuItem, MenuCategory, CommerceCategory } from '../../../core/supabase/database.types';
import { SettingsService } from '../../settings/settings.service';
import { AdminEmptyStateComponent } from '../shared/admin-empty-state.component';
import { AdminPageHeaderComponent } from '../shared/admin-page-header.component';

@Component({
    selector: 'app-store-catalog',
    standalone: true,
    imports: [CommonModule, FormsModule, ProductCardComponent, AdminEmptyStateComponent, AdminPageHeaderComponent],
    styles: [`
    .sections-panel {
      background: #fff;
      border-right: 1px solid #e7eaf1;
      flex-direction: column;
      min-width: 0;
    }
    .sections-header {
      padding: 20px 16px 14px;
      border-bottom: 1px solid #eef1f6;
    }
    .sections-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .sections-title {
      font-size: 13px;
      letter-spacing: .08em;
      color: #687084;
      font-weight: 800;
      text-transform: uppercase;
    }
    .add-section {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 12px;
      background: #eb1b8d;
      color: #fff;
      font-size: 20px;
      line-height: 0;
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 0 10px 18px rgba(235, 27, 141, .25);
    }
    .sections-help {
      margin: 8px 0 0;
      color: #9aa3b4;
      font-size: 12px;
      line-height: 1.45;
    }
    .quick-create-card {
      margin-top: 14px;
      border: 1px solid #ffd0e8;
      background: linear-gradient(180deg, #fff6fb, #fff);
      border-radius: 16px;
      padding: 12px;
      box-shadow: 0 8px 18px rgba(235, 27, 141, .08);
    }
    .quick-create-card strong {
      font-size: 13px;
      display: block;
      margin-bottom: 8px;
    }
    .quick-row {
      display: flex;
      gap: 8px;
    }
    .quick-row input {
      width: 100%;
      min-width: 0;
      height: 40px;
      border: 1px solid #f2c4df;
      border-radius: 12px;
      padding: 0 12px;
      font-family: inherit;
      outline: none;
      font-size: 13px;
      background: #fff;
    }
    .quick-row input:focus {
      border-color: #e91e8c;
      box-shadow: 0 0 0 4px rgba(235, 27, 141, .10);
    }
    .quick-row button {
      height: 40px;
      border: 0;
      border-radius: 12px;
      padding: 0 12px;
      background: #111827;
      color: #fff;
      font-family: inherit;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .section-list {
      padding: 12px;
      overflow: auto;
    }
    .section-item {
      position: relative;
      display: grid;
      grid-template-columns: 20px minmax(0,1fr) auto auto;
      align-items: center;
      gap: 10px;
      padding: 11px 10px;
      border-radius: 14px;
      margin-bottom: 6px;
      color: #1f2937;
      cursor: pointer;
      border: 1px solid transparent;
      transition: .16s ease;
    }
    .section-item:hover {
      background: #f8f9fc;
      border-color: #eef1f6;
    }
    .section-item.active {
      background: #ffe7f4;
      border-color: #ffd0e8;
      color: #a80e5f;
    }
    .drag {
      color: #bac1ce;
      font-size: 14px;
    }
    .section-name {
      font-size: 14px;
      font-weight: 700;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .section-meta {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: #9aa3b4;
      font-weight: 500;
    }
    .count {
      min-width: 28px;
      height: 28px;
      border-radius: 999px;
      background: #eef1f6;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 800;
      color: #667085;
    }
    .section-item.active .count {
      background: #fff;
      color: #e91e8c;
    }
    .dots {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      border: 0;
      background: transparent;
      color: #98a2b3;
      font-weight: 800;
      cursor: pointer;
    }
    .dots:hover {
      background: #fff;
      color: #111827;
    }
    .section-menu {
      position: absolute;
      right: 8px;
      top: 38px;
      z-index: 20;
      background: #fff;
      border: 1px solid #e7eaf1;
      border-radius: 12px;
      box-shadow: 0 10px 28px rgba(17,24,39,.12);
      overflow: hidden;
      min-width: 170px;
    }
    .section-menu button {
      width: 100%;
      border: 0;
      background: transparent;
      text-align: left;
      padding: 9px 12px;
      font-size: 12px;
      color: #475467;
      cursor: pointer;
    }
    .section-menu button:hover { background: #f9fafb; }
    .section-menu button.danger { color: #dc2626; }

    .section-form-enter {
      animation: section-slide-down 180ms ease-out;
    }
    @keyframes section-slide-down {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .drag-handle {
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      cursor: grab;
    }
    .group:hover .drag-handle { opacity: 1; }
    .drag-handle:active { cursor: grabbing; }

    .menu-filters-row {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .menu-search {
      position: relative;
      flex: 0 1 clamp(320px, 44%, 680px);
      min-width: 280px;
      max-width: 680px;
    }
    .menu-search svg {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: #9ca3af;
      pointer-events: none;
    }
    .menu-search input {
      width: 100%;
      height: 64px;
      border: 3px solid #eb1b8d;
      border-radius: 10px;
      background: #f3f4f6;
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      line-height: 1;
      padding: 0 18px 0 46px;
      outline: none;
      font-family: inherit;
    }
    .menu-search input::placeholder {
      color: #9ca3af;
    }
    .menu-search input:focus {
      box-shadow: 0 0 0 4px rgba(235, 27, 141, .12);
    }
    .menu-chip-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      min-width: 0;
      flex: 1 1 320px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .menu-chip-group::-webkit-scrollbar {
      display: none;
    }
    .toolbar-chip {
      height: 44px;
      border-radius: 999px;
      border: 1px solid #d8dde6;
      background: #f2f3f5;
      color: #111827;
      padding: 0 16px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: .15s ease;
    }
    .toolbar-chip:hover {
      background: #eceff3;
      border-color: #cfd5df;
    }
    .toolbar-chip.is-on {
      background: #eb1b8d;
      color: #fff;
      border-color: #eb1b8d;
      box-shadow: 0 10px 20px rgba(235, 27, 141, .18);
    }
    .chip-count {
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: #e5e7eb;
      color: #9ca3af;
    }
    .toolbar-chip.is-on .chip-count {
      background: rgba(255, 255, 255, .2);
      color: #fff;
    }
    .chip-count.has-value {
      background: #fce7f3;
      color: #d21d7e;
    }
    .menu-action-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-wrap: nowrap;
    }
    .view-toggle {
      display: flex;
      align-items: center;
      border: 1px solid #d8dde6;
      border-radius: 14px;
      background: #fff;
      overflow: hidden;
      height: 44px;
      flex-shrink: 0;
    }
    .view-toggle button {
      height: 100%;
      width: 40px;
      border: 0;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      transition: .15s ease;
    }
    .view-toggle button.active {
      background: #f3f4f6;
      color: #111827;
    }
    .csv-btn {
      height: 44px;
      border-radius: 14px;
      border: 1px solid #d8dde6;
      background: #fff;
      color: #111827;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .csv-btn:hover {
      background: #f9fafb;
    }
    @media (min-width: 1280px) {
      .menu-filters-row {
        flex-wrap: nowrap;
      }
    }
    @media (max-width: 1024px) {
      .menu-search input {
        height: 52px;
        font-size: 15px;
      }
      .toolbar-chip {
        height: 40px;
        padding: 0 12px;
        font-size: 13px;
      }
      .chip-count {
        min-width: 20px;
        height: 20px;
        font-size: 10px;
      }
      .view-toggle, .csv-btn {
        height: 40px;
      }
      .csv-btn {
        font-size: 13px;
      }
    }
    @media (max-width: 768px) {
      .menu-chip-group {
        flex-wrap: wrap;
        flex-basis: 100%;
        overflow-x: visible;
      }
      .menu-action-group {
        margin-left: 0;
        flex-wrap: wrap;
      }
      .menu-search {
        flex-basis: 100%;
        min-width: 0;
      }
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(17, 24, 39, 0.34);
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .modal {
      width: min(520px, 100%);
      background: #fff;
      border: 1px solid #eef1f6;
      border-radius: 26px;
      box-shadow: 0 28px 80px rgba(0,0,0,.24);
      overflow: hidden;
    }
    .modal-head {
      padding: 24px 26px 18px;
      border-bottom: 1px solid #eef1f6;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .modal-head h2 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -.03em;
      color: #111827;
    }
    .modal-head p {
      margin: 6px 0 0;
      color: #7b8496;
      font-size: 13px;
      line-height: 1.5;
    }
    .x {
      width: 38px;
      height: 38px;
      border: 1px solid #e7eaf1;
      background: #fff;
      border-radius: 14px;
      font-size: 20px;
      line-height: 1;
      color: #667085;
      cursor: pointer;
    }
    .modal-body {
      padding: 24px 26px;
    }
    .field {
      margin-bottom: 18px;
    }
    .field:last-child { margin-bottom: 0; }
    .field label {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #344054;
    }
    .optional {
      color: #9aa3b4;
      font-weight: 600;
      font-size: 11px;
    }
    .hint {
      color: #7b8496;
      font-size: 12px;
      line-height: 1.55;
      margin-top: 8px;
    }
    .modal-footer {
      padding: 18px 26px 24px;
      border-top: 1px solid #eef1f6;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `],
    template: `
  <div class="flex h-full overflow-hidden" style="min-height:calc(100vh - 64px)">

    <!-- ─── LEFT: Categories Panel (desktop only) ──────────────── -->
    <aside class="hidden lg:flex w-[300px] sections-panel">
      <div class="sections-header">
        <div class="sections-title-row">
          <div class="sections-title">Secciones del menú</div>
          <button class="add-section" title="Nueva sección" aria-label="Nueva sección" (click)="openNewCategoryForm()">+</button>
        </div>
        <p class="sections-help mb-0">Organiza tus productos por grupos visibles para el cliente.</p>

        <div class="quick-create-card block">
          <strong>Crear sección rápido</strong>
          <div class="quick-row">
            <input
              [(ngModel)]="quickSectionName"
              (keyup.enter)="createQuickSection()"
              placeholder="Ej: Burgers, Bebidas, Combos"
              aria-label="Nombre de sección" />
            <button type="button" (click)="createQuickSection()">Crear</button>
          </div>
        </div>
      </div>

      <div class="section-list">
        <div class="section-item" [class.active]="selectedCategoryId() === null" (click)="selectCategory(null)">
          <div class="drag">☰</div>
          <div>
            <div class="section-name">Todos los productos</div>
            <span class="section-meta">Vista completa</span>
          </div>
          <div class="count">{{ allProducts().length }}</div>
          <button class="dots" title="Opciones" aria-label="Opciones">⋮</button>
        </div>

        @for (cat of categories(); track cat.id; let i = $index) {
          <div
            class="section-item"
            [class.active]="selectedCategoryId() === cat.id"
            draggable="true"
            (dragstart)="onCategoryDragStart(i)"
            (dragover)="onCategoryDragOver($event)"
            (dragend)="onCategoryDragEnd()"
            (drop)="onCategoryDrop(i)"
            (click)="selectCategory(cat.id)">
            <div class="drag">☰</div>
            <div>
              <div class="section-name">{{ cat.name }}</div>
              <span class="section-meta">{{ sectionMeta(cat) || 'Nueva sección' }}</span>
            </div>
            <div class="count">{{ productCountByCategory()[cat.id] }}</div>
            <button type="button" class="dots opacity-100" title="Opciones" aria-label="Opciones" (click)="toggleSectionMenu(cat.id, $event)">⋮</button>

            @if (sectionMenuOpenId() === cat.id) {
              <div class="section-menu" (click)="$event.stopPropagation()">
                <button (click)="moveCategory(i, -1); closeSectionMenu()">Subir</button>
                <button (click)="moveCategory(i, 1); closeSectionMenu()">Bajar</button>
                <button (click)="toggleCategory(cat); closeSectionMenu()">{{ cat.is_active ? 'Desactivar' : 'Activar' }}</button>
                <button class="danger" (click)="deleteCategory(cat); closeSectionMenu()">Eliminar</button>
              </div>
            }
          </div>
        }
      </div>
    </aside>

    <!-- ─── RIGHT: Products Panel ───────────────────────────────── -->
    <main class="flex-1 flex flex-col overflow-hidden bg-gray-50">

      <!-- Mobile category selector (lg: hidden — uses aside instead) -->
      <div class="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
        <select
          class="input-field text-sm w-full"
          [ngModel]="selectedCategoryId()"
          (ngModelChange)="selectCategory($event === 'null' ? null : $event)">
          <option value="null">Todos los productos ({{ allProducts().length }})</option>
          @for (cat of categories(); track cat.id) {
            <option [value]="cat.id">{{ cat.name }} ({{ productCountByCategory()[cat.id] ?? 0 }})</option>
          }
        </select>
      </div>

      <!-- Top bar -->
      <div class="bg-white border-b border-gray-200 px-3 py-3 md:px-4 md:py-4 min-w-0">
        <app-admin-page-header
          [title]="catalogTitle()"
          subtitle="Organiza productos, ajusta disponibilidad y aplica filtros rápidos."
        >
          <ng-container actions>
            <button (click)="newProduct()"
              class="btn-primary flex items-center gap-2 text-sm py-2 flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo producto
            </button>
          </ng-container>

        <div class="menu-filters-row">
          <div class="menu-search">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.804 7.5 7.5 0 0 0 15.803 15.803Z"/>
            </svg>
            <input [(ngModel)]="searchQuery" placeholder="Buscar producto..." />
          </div>

          <div class="menu-chip-group">
            <button class="toolbar-chip" [class.is-on]="allFiltersOff()" (click)="resetFilters()">
              Todos
            </button>
            <button class="toolbar-chip" [class.is-on]="fAvailable()" (click)="toggleFilter('available')">
              Disponible
              <span class="chip-count" [class.has-value]="filterCounts().available > 0">{{ filterCounts().available }}</span>
            </button>
            <button class="toolbar-chip" [class.is-on]="fOutOfStock()" (click)="toggleFilter('outOfStock')">
              Sin stock
              <span class="chip-count" [class.has-value]="filterCounts().outOfStock > 0">{{ filterCounts().outOfStock }}</span>
            </button>
            <button class="toolbar-chip" [class.is-on]="fDiscounted()" (click)="toggleFilter('discounted')">
              Con descuento
              <span class="chip-count" [class.has-value]="filterCounts().discounted > 0">{{ filterCounts().discounted }}</span>
            </button>
            <button class="toolbar-chip" [class.is-on]="fFeatured()" (click)="toggleFilter('featured')">
              Destacados
              <span class="chip-count" [class.has-value]="filterCounts().featured > 0">{{ filterCounts().featured }}</span>
            </button>
          </div>

          <div class="menu-action-group">
            <div class="view-toggle">
              <button (click)="viewMode.set('grid')" [class.active]="viewMode() === 'grid'" title="Cuadrícula">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              </button>
              <button (click)="viewMode.set('list')" [class.active]="viewMode() === 'list'" title="Lista">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </button>
            </div>

            <button (click)="showBulkImport.set(true)"
              class="csv-btn"
              title="Exportar productos visibles a CSV">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              CSV
            </button>
          </div>
        </div>
        </app-admin-page-header>
      </div>

      <!-- Products area -->
      <div class="flex-1 overflow-y-auto p-3 md:p-4 min-w-0">
        @if (isLoading()) {
          <div class="flex justify-center py-16">
            <div class="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
          </div>
        } @else if (filteredProducts().length === 0 && selectedCategoryId() && !searchQuery.trim() && !fAvailable() && !fOutOfStock() && !fDiscounted() && !fFeatured()) {
          <div class="h-full min-h-[340px] flex items-center justify-center px-6">
            <app-admin-empty-state
              title="Esta sección está vacía"
              description="Agrega productos para que aparezcan en esta sección del menú."
              actionLabel="+ Nuevo producto"
              (action)="newProduct()" />
          </div>
        } @else if (filteredProducts().length === 0) {
          <div class="py-20">
            <app-admin-empty-state
              icon="search"
              title="No hay productos"
              description="Ajusta tus filtros o agrega un producto para comenzar."
              actionLabel="+ Nuevo producto"
              (action)="newProduct()" />
          </div>
        } @else if (viewMode() === 'grid') {
          <div class="grid gap-4 min-w-0" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));">
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

  <!-- ─── New Section Modal ────────────────────────────────────── -->
  @if (addingCategory()) {
    <div class="modal-overlay" (click)="cancelNewCategory()">
      <div class="modal section-form-enter" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <div>
            <h2>Nueva sección del menú</h2>
            <p>Crea un grupo visible para organizar los productos dentro del menú del comercio.</p>
          </div>
          <button class="x" (click)="cancelNewCategory()" aria-label="Cerrar">×</button>
        </div>

        <div class="modal-body">
          <div class="field">
            <label>Nombre de la sección</label>
            <input
              #newSectionInput
              [(ngModel)]="newCategoryName"
              (keyup.enter)="saveNewCategory()"
              class="input-field w-full text-sm py-2"
              placeholder="Ej: Burgers, Bebidas, Combos" />
          </div>

          <div class="field">
            <label>
              Categoría relacionada de Tuttyno
              <span class="optional">Opcional</span>
            </label>
            <select class="input-field w-full text-sm py-2" [(ngModel)]="newCategoryTuttyId">
              <option [ngValue]="null">Sin categoría relacionada</option>
              @for (cat of tuttyCategoriesForPicker(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
            <div class="hint">
              Esto ayuda a clasificar el comercio en Tuttyno, pero la sección del menú puede tener el nombre que el comercio necesite.
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button (click)="cancelNewCategory()" class="btn-secondary secondary-btn text-sm">Cancelar</button>
          <button (click)="saveNewCategory()" class="btn-primary primary-btn text-sm">Crear sección</button>
        </div>
      </div>
    </div>
  }

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
    private readonly settingsSvc = inject(SettingsService);
    private readonly toast = inject(ToastService);
    private readonly confirmSvc = inject(ConfirmService);
    private readonly router = inject(Router);
    private sub?: Subscription;
    @ViewChild('newSectionInput') private newSectionInput?: ElementRef<HTMLInputElement>;

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
    readonly draggingCategoryIndex = signal<number | null>(null);
    readonly sectionMenuOpenId = signal<string | null>(null);
    newCategoryName = '';
    quickSectionName = '';
    newCategoryTuttyId: string | null = null;
    readonly tuttyCategoriesForPicker = signal<CommerceCategory[]>([]);

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

    readonly tuttyCategoryNameMap = computed(() => {
        const map: Record<string, string> = {};
        for (const c of this.tuttyCategoriesForPicker()) {
            map[c.id] = c.name;
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

    readonly filterCounts = computed(() => {
        const products = this.allProducts();
        return {
            available: products.filter(p => p.is_available).length,
            outOfStock: products.filter(p => (p.stock_count ?? 1) <= 0).length,
            discounted: products.filter(p => !!p.discount_price).length,
            featured: products.filter(p => !!p.is_featured).length,
        };
    });

    readonly allFiltersOff = computed(() =>
        !this.fAvailable() && !this.fOutOfStock() && !this.fDiscounted() && !this.fFeatured()
    );

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

        // Load Tuttyno categories for the "new menu category" picker
        const commerceType = this.storeService.activeStore()?.commerce_type;
        if (commerceType) {
            this.settingsSvc.getStoreCategories(commerceType).then(
                cats => this.tuttyCategoriesForPicker.set(cats),
            ).catch(() => { });
        }
    }

    // ─── Category actions ─────────────────────────────────────────────────────
    selectCategory(id: string | null) {
        this.selectedCategoryId.set(id);
    }

    sectionMeta(cat: MenuCategory): string {
        if (!cat.tutty_category_id) return 'Sin categoría Tuttyno';
        return this.tuttyCategoryNameMap()[cat.tutty_category_id] ?? 'Categoría Tuttyno';
    }

    toggleSectionMenu(id: string, event: MouseEvent) {
        event.stopPropagation();
        this.sectionMenuOpenId.update(current => (current === id ? null : id));
    }

    closeSectionMenu() {
        this.sectionMenuOpenId.set(null);
    }

    openNewCategoryForm() {
        this.addingCategory.set(true);
        setTimeout(() => this.newSectionInput?.nativeElement.focus(), 0);
    }

    cancelNewCategory() {
        this.addingCategory.set(false);
        this.newCategoryName = '';
        this.newCategoryTuttyId = null;
    }

    async createQuickSection() {
        const name = this.quickSectionName.trim();
        const storeId = this.storeService.activeStoreId();
        if (!name || !storeId) return;
        try {
            const cat = await this.catalogService.createCategory(storeId, name, null);
            this.categories.update(list => [...list, cat]);
            this.quickSectionName = '';
            this.toast.success('Categoría creada');
        } catch {
            this.toast.error('Error al crear categoría');
        }
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

    onCategoryDragStart(index: number) {
        this.draggingCategoryIndex.set(index);
    }

    onCategoryDragOver(event: DragEvent) {
        event.preventDefault();
    }

    onCategoryDragEnd() {
        this.draggingCategoryIndex.set(null);
    }

    async onCategoryDrop(targetIndex: number) {
        const sourceIndex = this.draggingCategoryIndex();
        this.draggingCategoryIndex.set(null);
        if (sourceIndex === null || sourceIndex === targetIndex) return;

        const cats = [...this.categories()];
        const [moved] = cats.splice(sourceIndex, 1);
        if (!moved) return;
        cats.splice(targetIndex, 0, moved);

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
            const cat = await this.catalogService.createCategory(storeId, name, this.newCategoryTuttyId);
            this.categories.update(list => [...list, cat]);
            this.cancelNewCategory();
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

    @HostListener('document:click')
    onDocumentClick() {
        this.closeSectionMenu();
    }

    // ─── Filter chips ─────────────────────────────────────────────────────────
    toggleFilter(key: 'available' | 'outOfStock' | 'discounted' | 'featured') {
        if (key === 'available') this.fAvailable.update(v => !v);
        else if (key === 'outOfStock') this.fOutOfStock.update(v => !v);
        else if (key === 'discounted') this.fDiscounted.update(v => !v);
        else this.fFeatured.update(v => !v);
    }

    resetFilters() {
        this.fAvailable.set(false);
        this.fOutOfStock.set(false);
        this.fDiscounted.set(false);
        this.fFeatured.set(false);
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
