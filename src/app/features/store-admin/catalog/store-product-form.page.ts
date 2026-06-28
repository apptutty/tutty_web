import {
    Component,
    OnInit,
    signal,
    computed,
    inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreAdminService } from '../store-admin.service';
import { StoreCatalogService } from './store-catalog.service';
import { VariantsManagerComponent } from './variants-manager.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MenuItem, MenuCategory, ProductVariant, CommerceCategory } from '../../../core/supabase/database.types';
import { CommerceCategoryPickerComponent } from '../../../shared/ui/category-picker/commerce-category-picker.component';
import { SettingsService } from '../../settings/settings.service';
import { ScheduleWarningCardComponent } from '../shared/schedule-warning-card.component';
import { AdminPageHeaderComponent } from '../shared/admin-page-header.component';
import { AdminFormSectionComponent } from '../shared/admin-form-section.component';

const UNIT_TYPES = ['unidad', 'par', 'caja', 'frasco', 'pastilla', 'ml', 'mg', 'g', 'kg', 'litro', 'metro'];
const DAYS = [
    { key: 'lun', label: 'L' },
    { key: 'mar', label: 'M' },
    { key: 'mie', label: 'X' },
    { key: 'jue', label: 'J' },
    { key: 'vie', label: 'V' },
    { key: 'sab', label: 'S' },
    { key: 'dom', label: 'D' },
];

interface ProductForm {
    name: string;
    description: string;
    category_id: string | null;
    tutty_category_id: string | null;
    price: number | null;
    discount_price: number | null;
    is_available: boolean;
    is_featured: boolean;
    tags: string[];
    display_order: number;
    use_hours: boolean;
    available_from: string | null;
    available_until: string | null;
    use_days: boolean;
    available_days: string[];
    max_qty_per_order: number | null;
    preparation_time: number | null;
    calories: number | null;
    is_combo: boolean;
    requires_prescription: boolean;
    controlled_substance: boolean;
    brand: string | null;
    sku: string | null;
    barcode: string | null;
    unit_type: string | null;
    has_variants: boolean;
    track_stock: boolean;
    stock_count: number | null;
    low_stock_alert: number | null;
}

@Component({
    selector: 'app-store-product-form',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        VariantsManagerComponent,
        CommerceCategoryPickerComponent,
        ScheduleWarningCardComponent,
        AdminPageHeaderComponent,
        AdminFormSectionComponent,
    ],
    styles: [`
    :host {
      display: block;
      min-width: 0;
    }
    .product-editor-page {
      padding: 24px;
      display: grid;
      gap: 16px;
      background: var(--admin-bg, #f6f7fb);
      min-width: 0;
    }
    .product-editor-actions {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .action-secondary,
    .action-primary {
      height: 42px;
      border-radius: 15px;
      padding: 0 18px;
      font-size: 13px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .action-secondary {
      border-color: #e7eaf1;
      background: #fff;
      color: #344054;
    }
    .action-primary {
      background: linear-gradient(135deg, #f2299b, #df117f);
      color: #fff;
      box-shadow: 0 12px 22px rgba(235, 27, 141, .24);
    }
    .action-primary:disabled {
      opacity: .6;
      cursor: default;
    }
    .product-editor-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 380px;
      gap: 22px;
      align-items: start;
      max-width: 1320px;
      margin: 0 auto;
      width: 100%;
    }
    .product-editor-main {
      display: grid;
      gap: 18px;
      min-width: 0;
    }
    .product-editor-aside {
      position: sticky;
      top: 86px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .product-basic-grid {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
      min-width: 0;
    }
    .product-dropzone-label {
      display: block;
      margin-bottom: 8px;
      color: #344054;
      font-size: 13px;
      font-weight: 800;
    }
    .product-dropzone {
      border: 2px dashed #d6dce8;
      background: #fbfcff;
      border-radius: 22px;
      min-height: 250px;
      padding: 16px;
      display: grid;
      place-items: center;
      text-align: center;
      cursor: pointer;
      transition: border-color .15s, box-shadow .15s, background .15s;
    }
    .product-dropzone:hover,
    .product-dropzone:focus-visible {
      border-color: #eb1b8d;
      box-shadow: 0 0 0 4px rgba(235, 27, 141, .10);
      background: #fff;
      outline: none;
    }
    .product-dropzone img {
      width: 100%;
      max-height: 250px;
      object-fit: cover;
      border-radius: 16px;
    }
    .drop-icon {
      width: 70px;
      height: 70px;
      border-radius: 22px;
      background: #ffe7f4;
      color: #eb1b8d;
      display: grid;
      place-items: center;
      font-size: 32px;
      margin: 0 auto 12px;
    }
    .drop-title {
      margin: 0;
      color: #111827;
      font-size: 16px;
      font-weight: 800;
      line-height: 1.25;
    }
    .drop-link {
      margin: 8px 0 0;
      color: #eb1b8d;
      font-size: 13px;
      font-weight: 700;
    }
    .drop-hint {
      margin: 12px 0 0;
      color: #98a2b3;
      font-size: 12px;
      font-weight: 600;
    }
    .drop-remove {
      margin-top: 8px;
      border: 0;
      background: transparent;
      color: #b42318;
      font-size: 12px;
      text-decoration: underline;
      cursor: pointer;
      font-weight: 700;
    }
    .product-field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      min-width: 0;
    }
    .product-field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .product-field label {
      color: #344054;
      font-size: 12.5px;
      font-weight: 800;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }
    .optional {
      color: #a0a8b8;
      font-size: 11px;
      font-weight: 600;
    }
    .product-input,
    .product-select,
    .product-textarea {
      width: 100%;
      border: 1px solid #e7eaf1;
      border-radius: 15px;
      background: #fbfcff;
      color: #111827;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: .15s;
    }
    .product-input,
    .product-select {
      height: 48px;
      padding: 0 14px;
    }
    .product-textarea {
      min-height: 116px;
      resize: vertical;
      padding: 12px 14px;
      line-height: 1.45;
    }
    .product-input::placeholder,
    .product-textarea::placeholder {
      color: #98a2b3;
    }
    .product-input:focus,
    .product-select:focus,
    .product-textarea:focus {
      border-color: #eb1b8d;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(235,27,141,.10);
    }
    .product-category-box {
      border: 1px solid #e7eaf1;
      border-radius: 16px;
      background: #fbfcff;
      padding: 12px;
      display: grid;
      gap: 10px;
    }
    .category-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .category-label {
      color: #98a2b3;
      font-size: 13px;
      font-weight: 600;
    }
    .category-value {
      color: #344054;
      font-size: 14px;
      font-weight: 700;
    }
    .category-hint {
      margin: 0;
      color: #98a2b3;
      font-size: 13px;
      line-height: 1.5;
    }
    .category-btn {
      height: 40px;
      border-radius: 13px;
      border: 1px solid #d6dce8;
      background: #fff;
      color: #344054;
      font-weight: 800;
      font-size: 13px;
      padding: 0 16px;
      cursor: pointer;
    }
    .tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #ffe7f4;
      color: #be185d;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .tag-chip button {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-weight: 800;
      line-height: 1;
    }
    .product-check-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .product-check-pill {
      min-height: 38px;
      border: 1px solid #e7eaf1;
      border-radius: 999px;
      background: #fff;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      color: #344054;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .product-check-pill input {
      width: 20px;
      height: 20px;
      accent-color: #eb1b8d;
      margin: 0;
    }
    .product-range-wrap {
      border: 1px solid #e7eaf1;
      border-radius: 20px;
      background: #fbfcff;
      padding: 14px;
      display: grid;
      gap: 10px;
    }
    .range-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .range-head strong {
      color: #111827;
      font-size: 15px;
      font-weight: 800;
    }
    .range-head span {
      color: #eb1b8d;
      font-size: 14px;
      font-weight: 800;
    }
    .product-range {
      width: 100%;
      accent-color: #eb1b8d;
    }
    .range-meta {
      display: flex;
      justify-content: space-between;
      color: #98a2b3;
      font-size: 12px;
      font-weight: 600;
    }
    .range-hint {
      margin: 0;
      color: #98a2b3;
      font-size: 12px;
      line-height: 1.5;
    }
    .product-preview-card {
      border: 1px solid #e7eaf1;
      border-radius: 24px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(18,24,40,.07);
      padding: 18px;
      display: grid;
      gap: 12px;
    }
    .aside-head h3 {
      margin: 0;
      font-size: 16px;
      color: #111827;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .aside-head p {
      margin: 8px 0 0;
      color: #667085;
      font-size: 12.5px;
      line-height: 1.5;
      font-weight: 500;
    }
    .product-preview {
      border: 1px solid #e7eaf1;
      border-radius: 22px;
      overflow: hidden;
      background: #fff;
    }
    .product-preview-image {
      margin: 16px;
      border-radius: 22px;
      background: #f2f4f7;
      min-height: 190px;
      display: grid;
      place-items: center;
      overflow: hidden;
      position: relative;
    }
    .product-preview-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .featured-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: #f0b429;
      color: #fff;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 800;
    }
    .preview-body {
      padding: 0 16px 16px;
      display: grid;
      gap: 8px;
    }
    .product-preview-category {
      margin: 0;
      color: #98a2b3;
      font-size: 13px;
      font-weight: 700;
    }
    .product-preview-name {
      margin: 0;
      color: #111827;
      font-size: 22px;
      line-height: 1.15;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .product-preview-meta {
      margin: 0;
      color: #98a2b3;
      font-size: 13px;
      font-weight: 600;
    }
    .product-preview-price {
      margin: 0;
      color: #111827;
      font-size: 26px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.04em;
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }
    .price-old {
      font-size: 14px;
      color: #98a2b3;
      font-weight: 700;
      text-decoration: line-through;
    }
    .product-preview-footer {
      border-top: 1px solid #eef1f6;
      padding-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .preview-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 800;
    }
    .preview-status.on {
      background: #eafbf1;
      color: #067647;
    }
    .preview-status.off {
      background: #feefef;
      color: #b42318;
    }
    .preview-pill {
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 800;
      background: #ffe7f4;
      color: #be185d;
    }
    .product-summary-list {
      display: grid;
      gap: 8px;
    }
    .product-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eef1f6;
      color: #667085;
      font-size: 12px;
      font-weight: 700;
    }
    .product-summary-row:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .product-summary-row strong {
      color: #111827;
      font-size: 17px;
      font-weight: 800;
      text-align: right;
    }
    .product-checklist-card {
      border: 1px solid #ffd0e8;
      border-radius: 24px;
      background: #fff6fb;
      padding: 20px;
      display: grid;
      gap: 10px;
    }
    .product-checklist {
      margin: 0;
      padding-left: 18px;
      color: #667085;
      font-size: 13px;
      line-height: 1.6;
      font-weight: 500;
    }
    .product-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 2px;
    }
    @media (max-width: 1280px) {
      .product-editor-layout {
        grid-template-columns: 1fr;
        max-width: 900px;
      }
      .product-editor-aside {
        position: static;
      }
    }
    @media (max-width: 980px) {
      .product-editor-page {
        padding: 16px;
      }
      .product-editor-actions {
        width: 100%;
        justify-content: flex-end;
      }
      .product-basic-grid {
        grid-template-columns: 1fr;
      }
      .product-dropzone {
        min-height: 220px;
      }
      .product-field-grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 680px) {
      .product-editor-actions {
        flex-direction: column;
        align-items: stretch;
      }
      .action-secondary,
      .action-primary {
        width: 100%;
      }
      .product-footer-actions {
        flex-direction: column;
      }
      .product-preview-name {
        font-size: 30px;
      }
      .product-preview-price {
        font-size: 38px;
      }
    }
  `],
    template: `
    <div class="product-editor-page">
      @if (showOutsideScheduleAlert() && !warningDismissed()) {
        <app-schedule-warning-card
          [scheduleWindow]="scheduleWindow()"
          (editSchedule)="goToSettings()"
          (close)="warningDismissed.set(true)" />
      }

      <app-admin-page-header
        [title]="isEditMode() ? 'Editar producto' : 'Nuevo producto'"
        [subtitle]="isEditMode()
          ? 'Actualiza la información, precio y disponibilidad del producto.'
          : ('Crea un producto para el menú de ' + storeName() + '.')"
        [showBack]="true"
        backAriaLabel="Volver al catálogo"
        (back)="goBackToCatalog()"
      >
        <ng-container actions>
          <div class="product-editor-actions">
            <a routerLink="/store/catalog" class="action-secondary">Cancelar</a>
            <button type="button" class="action-primary" [disabled]="isSaving()" (click)="submit()">
              {{ isSaving() ? 'Guardando...' : (isEditMode() ? 'Guardar cambios' : 'Crear producto') }}
            </button>
          </div>
        </ng-container>
      </app-admin-page-header>

      <div class="product-editor-layout">
        <form (ngSubmit)="submit()" class="product-editor-main">
          <app-admin-form-section
            title="Información básica"
            subtitle="Define cómo se verá el producto dentro del menú."
          >
            <div class="product-basic-grid">
              <div>
                <label class="product-dropzone-label">Foto del producto</label>
                <input #fileInput type="file" class="hidden" accept="image/png,image/jpeg,image/webp" (change)="onPhotoInputChange($event)" />
                <div class="product-dropzone" role="button" tabindex="0" aria-label="Foto del producto" (click)="fileInput.click()" (keydown.enter)="fileInput.click()" (keydown.space)="fileInput.click()">
                  @if (photoPreview()) {
                    <img [src]="photoPreview()!" alt="Foto del producto" />
                  } @else {
                    <div>
                      <div class="drop-icon">🖼️</div>
                      <p class="drop-title">Arrastra una imagen aquí</p>
                      <p class="drop-link">o haz clic para subir</p>
                      <p class="drop-hint">JPG, PNG · máx. 5MB</p>
                    </div>
                  }
                </div>
                @if (photoPreview()) {
                  <button type="button" class="drop-remove" (click)="clearPhoto()">Quitar imagen</button>
                }
              </div>

              <div class="product-field">
                <div class="product-field">
                  <label>Nombre *</label>
                  <input [(ngModel)]="form.name" name="name" required class="product-input" placeholder="Ej: Pizza Margarita" />
                </div>
                <div class="product-field">
                  <label>Descripción</label>
                  <textarea [(ngModel)]="form.description" name="description" class="product-textarea" placeholder="Descripción breve del producto..."></textarea>
                </div>
                <div class="product-field-grid">
                  <div class="product-field">
                    <label>Sección del menú</label>
                    <select [(ngModel)]="form.category_id" name="category_id" class="product-select">
                      <option [value]="null">Sin sección</option>
                      @for (cat of categories(); track cat.id) {
                        <option [value]="cat.id">{{ cat.name }}{{ !cat.tutty_category_id ? ' ⚠️' : '' }}</option>
                      }
                    </select>
                  </div>
                  <div class="product-field">
                    <label>Orden de visualización</label>
                    <input type="number" [(ngModel)]="form.display_order" name="display_order" min="0" class="product-input" />
                  </div>
                </div>

                <div class="product-category-box">
                  <div class="category-top">
                    <div>
                      <div class="category-label">Categoría Tuttyno relacionada</div>
                      <div class="category-value">
                        {{ resolvedTuttyCategory() ? resolvedTuttyCategory()!.name : 'Sin categoría relacionada' }}
                      </div>
                    </div>
                    <button type="button" class="category-btn" (click)="overrideTuttyOpen.set(!overrideTuttyOpen())">Cambiar</button>
                  </div>
                  <p class="category-hint">Esto ayuda a clasificar el producto dentro de Tuttyno, pero no cambia la sección visible del menú.</p>
                  @if (overrideTuttyOpen()) {
                    <app-commerce-category-picker
                      label="Categoría Tuttyno relacionada"
                      placeholder="Seleccionar categoría..."
                      [categories]="tuttyCategoriesForProduct()"
                      [selectedId]="form.tutty_category_id"
                      [loading]="tuttyCategoriesLoading()"
                      [allowClear]="true"
                      (categorySelected)="form.tutty_category_id = $event?.id ?? null">
                    </app-commerce-category-picker>
                  }
                </div>
              </div>
            </div>
          </app-admin-form-section>

          <app-admin-form-section
            title="Precio y disponibilidad"
            subtitle="Configura precio, visibilidad y etiquetas comerciales."
          >
            <div class="product-field-grid">
              <div class="product-field">
                <label>Precio *</label>
                <input type="number" [(ngModel)]="form.price" name="price" required min="0" step="0.01" class="product-input" placeholder="$0.00" />
              </div>
              <div class="product-field">
                <label>Precio con descuento <span class="optional">Opcional</span></label>
                <input type="number" [(ngModel)]="form.discount_price" name="discount_price" min="0" step="0.01" class="product-input" placeholder="Opcional" />
              </div>
            </div>

            <div class="product-field">
              <label>Etiquetas</label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                @for (tag of form.tags; track tag) {
                  <span class="tag-chip">
                    {{ tag }}
                    <button type="button" (click)="removeTag(tag)">✕</button>
                  </span>
                }
              </div>
              <input [(ngModel)]="tagInput" name="tagInput"
                (keydown.enter)="addTag(); $event.preventDefault()"
                (keydown.comma)="addTag(); $event.preventDefault()"
                placeholder="Escribe y presiona Enter para agregar..."
                class="product-input" />
            </div>

            <div class="product-check-row">
              <label class="product-check-pill">
                <input type="checkbox" [(ngModel)]="form.is_available" name="is_available" />
                Disponible
              </label>
              <label class="product-check-pill">
                <input type="checkbox" [(ngModel)]="form.is_featured" name="is_featured" />
                Destacado
              </label>
            </div>
          </app-admin-form-section>

          <app-admin-form-section
            title="Horario y límites"
            subtitle="Controla cuándo y cuánto puede ordenar el cliente."
          >
            <div class="product-check-row">
              <label class="product-check-pill">
                <input type="checkbox" [(ngModel)]="form.use_hours" name="use_hours" />
                Disponible en horario específico
              </label>
              <label class="product-check-pill">
                <input type="checkbox" [(ngModel)]="form.use_days" name="use_days" />
                Solo en días específicos
              </label>
            </div>

            @if (form.use_hours) {
              <div class="product-field-grid">
                <div class="product-field">
                  <label>Desde</label>
                  <input type="time" [(ngModel)]="form.available_from" name="available_from" class="product-input" />
                </div>
                <div class="product-field">
                  <label>Hasta</label>
                  <input type="time" [(ngModel)]="form.available_until" name="available_until" class="product-input" />
                </div>
              </div>
            }

            @if (form.use_days) {
              <div class="product-check-row">
                @for (day of days; track day.key) {
                  <button type="button" class="category-btn" [class.action-primary]="form.available_days.includes(day.key)" (click)="toggleDay(day.key)">
                    {{ day.label }}
                  </button>
                }
              </div>
            }

            <div class="product-field" style="max-width: 520px;">
              <label>Máxima cantidad por pedido</label>
              <input type="number" [(ngModel)]="form.max_qty_per_order" name="max_qty_per_order" min="1" class="product-input" placeholder="Sin límite" />
            </div>
          </app-admin-form-section>

          @if (commerceType() === 'restaurante') {
            <app-admin-form-section
              title="Opciones de menú"
              subtitle="Agrega detalles operativos y nutricionales."
            >
              <div class="product-range-wrap">
                <div class="range-head">
                  <strong>Tiempo de preparación</strong>
                  <span>{{ form.preparation_time ?? 0 }} min</span>
                </div>
                <input type="range" [(ngModel)]="form.preparation_time" name="preparation_time" min="0" max="120" step="5" class="product-range" />
                <div class="range-meta"><span>0 min</span><span>120 min</span></div>
                <p class="range-hint">Este tiempo ayuda a calcular la promesa de entrega al cliente.</p>
              </div>

              <div class="product-field-grid">
                <div class="product-field">
                  <label>Calorías (kcal) <span class="optional">Opcional</span></label>
                  <input type="number" [(ngModel)]="form.calories" name="calories" min="0" class="product-input" placeholder="Opcional" />
                </div>
                <div class="product-field pt-6">
                  <label class="product-check-pill">
                    <input type="checkbox" [(ngModel)]="form.is_combo" name="is_combo" />
                    Es combo / combo meal
                  </label>
                </div>
              </div>
            </app-admin-form-section>
          }

          @if (commerceType() === 'farmacia') {
            <app-admin-form-section
              title="Información farmacéutica"
              subtitle="Configura datos regulatorios y de inventario para farmacia."
            >
              <div class="product-check-row">
                <label class="product-check-pill">
                  <input type="checkbox" [(ngModel)]="form.requires_prescription" name="requires_prescription" />
                  Requiere receta (Rx)
                </label>
                <label class="product-check-pill">
                  <input type="checkbox" [(ngModel)]="form.controlled_substance" name="controlled_substance" />
                  Sustancia controlada
                </label>
              </div>
              <div class="product-field-grid">
                <div class="product-field">
                  <label>Marca / Laboratorio</label>
                  <input [(ngModel)]="form.brand" name="brand" class="product-input" placeholder="Ej. Bayer" />
                </div>
                <div class="product-field">
                  <label>Unidad de medida</label>
                  <select [(ngModel)]="form.unit_type" name="unit_type" class="product-select">
                    <option [value]="null">—</option>
                    @for (u of unitTypes; track u) { <option [value]="u">{{ u }}</option> }
                  </select>
                </div>
                <div class="product-field">
                  <label>SKU / Código interno</label>
                  <input [(ngModel)]="form.sku" name="sku" class="product-input" placeholder="ABC-123" />
                </div>
                <div class="product-field">
                  <label>Código de barras</label>
                  <input [(ngModel)]="form.barcode" name="barcode" class="product-input" placeholder="7501234567890" />
                </div>
              </div>
            </app-admin-form-section>
          }

          @if (commerceType() === 'bodega' || commerceType() === 'colmado' || commerceType() === 'supermercado') {
            <app-admin-form-section
              title="Información del producto"
              subtitle="Completa atributos comerciales para catálogo e inventario."
            >
              <div class="product-field-grid">
                <div class="product-field">
                  <label>Marca</label>
                  <input [(ngModel)]="form.brand" name="brand_gro" class="product-input" placeholder="Ej. Nestlé" />
                </div>
                <div class="product-field">
                  <label>Unidad de medida</label>
                  <select [(ngModel)]="form.unit_type" name="unit_type_gro" class="product-select">
                    <option [value]="null">—</option>
                    @for (u of unitTypes; track u) { <option [value]="u">{{ u }}</option> }
                  </select>
                </div>
                <div class="product-field">
                  <label>SKU</label>
                  <input [(ngModel)]="form.sku" name="sku_gro" class="product-input" placeholder="ABC-123" />
                </div>
                <div class="product-field">
                  <label>Código de barras</label>
                  <input [(ngModel)]="form.barcode" name="barcode_gro" class="product-input" />
                </div>
              </div>
            </app-admin-form-section>
          }

          @if (commerceType() === 'tienda_ropa' || commerceType() === 'electronica') {
            <app-admin-form-section
              [title]="commerceType() === 'tienda_ropa' ? 'Tallas y colores' : 'Variantes'"
              subtitle="Gestiona las variaciones comerciales del producto."
            >
              <div class="product-field-grid">
                <div class="product-field">
                  <label>SKU base</label>
                  <input [(ngModel)]="form.sku" name="sku_var" class="product-input" placeholder="BASE-001" />
                </div>
              </div>
              <label class="product-check-pill">
                <input type="checkbox" [(ngModel)]="form.has_variants" name="has_variants" />
                Este producto tiene variantes
              </label>
              @if (form.has_variants) {
                <app-variants-manager
                  [initialVariants]="existingVariants()"
                  [commerceType]="commerceType()"
                  (variantsChange)="pendingVariants = $event" />
              }
            </app-admin-form-section>
          }

          @if (commerceType() !== 'restaurante') {
            <app-admin-form-section
              title="Control de inventario"
              subtitle="Configura stock, alertas y disponibilidad automática."
            >
              <label class="product-check-pill">
                <input type="checkbox" [(ngModel)]="form.track_stock" name="track_stock" />
                Rastrear stock de este producto
              </label>
              @if (form.track_stock) {
                <div class="product-field-grid">
                  <div class="product-field">
                    <label>Cantidad en stock</label>
                    <input type="number" [(ngModel)]="form.stock_count" name="stock_count" min="0" class="product-input" placeholder="0" />
                  </div>
                  <div class="product-field">
                    <label>Alerta de stock bajo</label>
                    <input type="number" [(ngModel)]="form.low_stock_alert" name="low_stock_alert" min="0" class="product-input" placeholder="Ej. 5" />
                  </div>
                </div>
              }
            </app-admin-form-section>
          }

          <div class="product-footer-actions">
            <a routerLink="/store/catalog" class="action-secondary">Cancelar</a>
            <button type="submit" [disabled]="isSaving()" class="action-primary">
              {{ isSaving() ? 'Guardando...' : (isEditMode() ? 'Guardar cambios' : 'Crear producto') }}
            </button>
          </div>
        </form>

        <aside class="product-editor-aside">
          <section class="product-preview-card">
            <div class="aside-head">
              <h3>Vista previa</h3>
              <p>Así se verá el producto en el menú.</p>
            </div>
            <div class="product-preview">
              <div class="product-preview-image">
                @if (form.is_featured) {
                  <span class="featured-badge">Destacado</span>
                }
                @if (photoPreview()) {
                  <img [src]="photoPreview()!" alt="Vista previa del producto" />
                } @else {
                  <span class="text-5xl">🖼️</span>
                }
              </div>
              <div class="preview-body">
                <p class="product-preview-category">{{ selectedSectionName() }}</p>
                <p class="product-preview-name">{{ form.name || 'Nombre del producto' }}</p>
                <p class="product-preview-meta">⏱ {{ form.preparation_time ?? 15 }} min</p>
                <p class="product-preview-price">
                  &#36;{{ (form.price ?? 0).toFixed(2) }}
                  @if (form.discount_price && form.discount_price > 0) {
                    <span class="price-old">&#36;{{ form.discount_price.toFixed(2) }}</span>
                  }
                </p>
                <div class="product-preview-footer">
                  <span class="preview-status" [class.on]="form.is_available" [class.off]="!form.is_available">
                    {{ form.is_available ? 'Disponible' : 'No disponible' }}
                  </span>
                  <span class="preview-pill">Menú</span>
                </div>
              </div>
            </div>
          </section>

          <section class="product-preview-card">
            <div class="aside-head">
              <h3>Resumen</h3>
              <p>Revisa los detalles antes de publicar.</p>
            </div>
            <div class="product-summary-list">
              <div class="product-summary-row"><span>Sección</span><strong>{{ selectedSectionName() }}</strong></div>
              <div class="product-summary-row"><span>Categoría Tuttyno</span><strong>{{ resolvedTuttyCategory() ? resolvedTuttyCategory()!.name : 'Sin categoría' }}</strong></div>
              <div class="product-summary-row"><span>Orden</span><strong>{{ form.display_order ?? 0 }}</strong></div>
              <div class="product-summary-row"><span>Máx. por pedido</span><strong>{{ form.max_qty_per_order ?? 'Sin límite' }}</strong></div>
              <div class="product-summary-row"><span>Combo</span><strong>{{ form.is_combo ? 'Sí' : 'No' }}</strong></div>
            </div>
          </section>

          <section class="product-checklist-card">
            <div class="aside-head">
              <h3>Checklist</h3>
              <p>Completa lo necesario para publicar bien el producto.</p>
            </div>
            <ul class="product-checklist">
              <li>Agrega una foto clara del producto.</li>
              <li>Usa un nombre corto y fácil de entender.</li>
              <li>Confirma precio y disponibilidad.</li>
              <li>Asigna la sección correcta del menú.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  `,
})
export class StoreProductFormPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly storeService = inject(StoreAdminService);
    private readonly catalogService = inject(StoreCatalogService);
    private readonly settingsSvc = inject(SettingsService);
    private readonly toast = inject(ToastService);

    readonly isLoading = signal(false);
    readonly isSaving = signal(false);
    readonly categories = signal<MenuCategory[]>([]);
    readonly tuttyCategoriesForProduct = signal<CommerceCategory[]>([]);
    readonly tuttyCategoriesLoading = signal(false);
    readonly existingVariants = signal<Partial<ProductVariant>[]>([]);
    readonly productId = signal<string | null>(null);
    readonly photoPreviewSignal = signal<string | null>(null);
    readonly warningDismissed = signal(false);

    pendingVariants: Partial<ProductVariant>[] = [];
    tagInput = '';
    private photoFile: File | null = null;
    readonly uploadingPhoto = signal(false);

    readonly unitTypes = UNIT_TYPES;
    readonly days = DAYS;

    form: ProductForm = {
        name: '', description: '', category_id: null, tutty_category_id: null,
        price: null, discount_price: null,
        is_available: true, is_featured: false, tags: [], display_order: 0,
        use_hours: false, available_from: null, available_until: null,
        use_days: false, available_days: [],
        max_qty_per_order: null,
        preparation_time: null, calories: null, is_combo: false,
        requires_prescription: false, controlled_substance: false,
        brand: null, sku: null, barcode: null, unit_type: null,
        has_variants: false,
        track_stock: false, stock_count: null, low_stock_alert: null,
    };

    readonly commerceType = computed(() => this.storeService.activeStore()?.commerce_type ?? 'otro');
    readonly isEditMode = computed(() => !!this.productId());
    readonly photoPreview = this.photoPreviewSignal;
    readonly storeName = computed(() => this.storeService.activeStore()?.name ?? 'QA Burger Naco');
    readonly outsideSchedule = computed(() => this.storeService.isOutsideSchedule());
    readonly showOutsideScheduleAlert = computed(() => (this.storeService.activeStore()?.is_open ?? false) && this.outsideSchedule());
    readonly scheduleWindow = computed(() => {
        const store = this.storeService.activeStore();
        if (!store?.opening_time || !store?.closing_time) return 'Horario no configurado';
        return `${this.fmt12(store.opening_time)} - ${this.fmt12(store.closing_time)}`;
    });

    readonly overrideTuttyOpen = signal(false);
    readonly selectedSection = computed(() =>
        this.categories().find(c => c.id === this.form.category_id) ?? null
    );

    readonly inheritedTuttyCategory = computed(() => {
        const sectionTuttyId = this.selectedSection()?.tutty_category_id;
        if (!sectionTuttyId) return null;
        return this.tuttyCategoriesForProduct().find(c => c.id === sectionTuttyId) ?? null;
    });

    readonly resolvedTuttyCategory = computed(() => {
        const overrideId = this.form.tutty_category_id;
        if (overrideId) {
            return this.tuttyCategoriesForProduct().find(c => c.id === overrideId) ?? null;
        }
        return this.inheritedTuttyCategory();
    });

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        const storeId = this.storeService.activeStoreId();
        const commerceType = this.storeService.activeStore()?.commerce_type;
        if (storeId) {
            this.catalogService.getCategories(storeId).subscribe(cats => this.categories.set(cats));
        }
        if (commerceType) {
            this.tuttyCategoriesLoading.set(true);
            this.settingsSvc.getStoreCategories(commerceType as any).then(
                cats => { this.tuttyCategoriesForProduct.set(cats); this.tuttyCategoriesLoading.set(false); },
            ).catch(() => this.tuttyCategoriesLoading.set(false));
        }
        if (id && id !== 'new') {
            this.productId.set(id);
            this.loadProduct(id);
        }
    }

    selectedSectionName(): string {
        return this.selectedSection()?.name ?? 'Sin sección';
    }

    onPhotoInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.onPhotoSelected(file);
        input.value = '';
    }

    goToSettings() {
        this.router.navigate(['/store/settings']);
    }

    goBackToCatalog() {
        this.router.navigate(['/store/catalog']);
    }

    private loadProduct(id: string) {
        this.isLoading.set(true);
        this.catalogService.getProductById(id).subscribe({
            next: (p) => {
                this.form = {
                    name: p.name,
                    description: p.description ?? '',
                    category_id: p.category_id ?? null,
                    tutty_category_id: (p.tutty_category_id ?? p.food_type_id) ?? null,
                    price: p.price,
                    discount_price: p.discount_price ?? null,
                    is_available: p.is_available,
                    is_featured: p.is_featured,
                    tags: p.tags ?? [],
                    display_order: p.display_order,
                    use_hours: !!(p.available_from || p.available_until),
                    available_from: p.available_from ?? null,
                    available_until: p.available_until ?? null,
                    use_days: !!(p.available_days?.length),
                    available_days: p.available_days ?? [],
                    max_qty_per_order: p.max_qty_per_order ?? null,
                    preparation_time: p.preparation_time ?? null,
                    calories: p.calories ?? null,
                    is_combo: p.is_combo ?? false,
                    requires_prescription: p.requires_prescription ?? false,
                    controlled_substance: p.controlled_substance ?? false,
                    brand: p.brand ?? null,
                    sku: p.sku ?? null,
                    barcode: p.barcode ?? null,
                    unit_type: p.unit_type ?? null,
                    has_variants: p.has_variants,
                    track_stock: p.track_stock,
                    stock_count: p.stock_count ?? null,
                    low_stock_alert: p.low_stock_alert ?? null,
                };
                if (p.photo_url) this.photoPreviewSignal.set(p.photo_url);
                if (p.has_variants) {
                    this.catalogService.getVariants(id).subscribe(v => {
                        this.existingVariants.set(v);
                        this.pendingVariants = v;
                    });
                }
                if (p.tutty_category_id || p.food_type_id) {
                    this.overrideTuttyOpen.set(true);
                }
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar el producto');
                this.isLoading.set(false);
            },
        });
    }

    addTag() {
        const tag = this.tagInput.replace(/,$/, '').trim();
        if (tag && !this.form.tags.includes(tag)) this.form.tags = [...this.form.tags, tag];
        this.tagInput = '';
    }

    removeTag(tag: string) {
        this.form.tags = this.form.tags.filter(t => t !== tag);
    }

    toggleDay(key: string) {
        this.form.available_days = this.form.available_days.includes(key)
            ? this.form.available_days.filter(d => d !== key)
            : [...this.form.available_days, key];
    }

    onPhotoSelected(file: File): void {
        this.photoFile = file;
        this.photoPreviewSignal.set(URL.createObjectURL(file));
    }

    clearPhoto(): void {
        this.photoFile = null;
        this.photoPreviewSignal.set(null);
    }

    async submit() {
        if (!this.form.name || this.form.price == null) {
            this.toast.warning('Nombre y precio son obligatorios');
            return;
        }
        const storeId = this.storeService.activeStoreId();
        if (!storeId) return;

        this.isSaving.set(true);
        try {
            let photoUrl: string | null = null;
            if (this.photoFile) {
                this.uploadingPhoto.set(true);
                photoUrl = await this.catalogService.uploadProductImage(
                    this.photoFile,
                    storeId,
                    this.productId() ?? undefined,
                );
                this.uploadingPhoto.set(false);
                this.photoFile = null;
            }

            const payload: Partial<MenuItem> = {
                name: this.form.name,
                description: this.form.description || null,
                category_id: this.form.category_id,
                tutty_category_id: this.form.tutty_category_id,
                price: this.form.price!,
                discount_price: this.form.discount_price,
                is_available: this.form.is_available,
                is_featured: this.form.is_featured,
                tags: this.form.tags,
                display_order: this.form.display_order,
                available_from: this.form.use_hours ? this.form.available_from : null,
                available_until: this.form.use_hours ? this.form.available_until : null,
                available_days: this.form.use_days ? this.form.available_days : [],
                max_qty_per_order: this.form.max_qty_per_order,
                preparation_time: this.form.preparation_time,
                calories: this.form.calories,
                is_combo: this.form.is_combo,
                requires_prescription: this.form.requires_prescription,
                controlled_substance: this.form.controlled_substance,
                brand: this.form.brand,
                sku: this.form.sku,
                barcode: this.form.barcode,
                unit_type: this.form.unit_type,
                has_variants: this.form.has_variants,
                track_stock: this.form.track_stock,
                stock_count: this.form.track_stock ? this.form.stock_count : null,
                low_stock_alert: this.form.track_stock ? this.form.low_stock_alert : null,
                ...(photoUrl ? { photo_url: photoUrl } : {}),
            };

            let savedId = this.productId();

            if (savedId) {
                await this.catalogService.updateProduct(savedId, payload);
            } else {
                const created = await this.catalogService.createProduct(storeId, payload);
                savedId = created.id;
            }

            if (this.form.has_variants && savedId && this.pendingVariants.length > 0) {
                await this.catalogService.saveVariants(savedId, this.pendingVariants);
            }

            this.toast.success(this.isEditMode() ? 'Producto actualizado' : 'Producto creado');
            this.router.navigate(['/store/catalog']);
        } catch (err) {
            console.error(err);
            this.toast.error('Error al guardar el producto');
        } finally {
            this.isSaving.set(false);
        }
    }

    private fmt12(time: string): string {
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    }
}
