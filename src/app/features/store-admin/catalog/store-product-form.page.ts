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
import { MenuItem, MenuCategory, ProductVariant } from '../../../core/supabase/database.types';

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
    imports: [CommonModule, FormsModule, RouterLink, VariantsManagerComponent],
    styles: [`
    .section-title { font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; margin-bottom:12px; }
    .day-btn { width:32px; height:32px; border-radius:50%; border:2px solid #e5e7eb; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.15s; }
    .day-btn.on { background:#e91e8c; border-color:#e91e8c; color:white; }
    .day-btn:not(.on):hover { border-color:#e91e8c; color:#e91e8c; }
    .tag-chip { display:inline-flex; align-items:center; gap:4px; padding:2px 10px; background:#fce7f3; color:#9d174d; border-radius:99px; font-size:0.75rem; }
    input[type=range]::-webkit-slider-thumb { accent-color:#e91e8c; }
  `],
    template: `
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
      <a routerLink="/store/catalog"
        class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </a>
      <h1 class="text-xl font-bold text-gray-900 flex-1">
        {{ isEditMode() ? 'Editar producto' : 'Nuevo producto' }}
      </h1>
      @if (isLoading()) {
        <div class="w-5 h-5 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin"></div>
      }
      <button type="button" (click)="submit()" [disabled]="isSaving()"
        class="btn-primary px-5 py-2 text-sm disabled:opacity-50">
        {{ isSaving() ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>

    <form (ngSubmit)="submit()" class="max-w-3xl mx-auto p-6 space-y-6">

      <!-- ─── S1: Información básica ──────────────────────────── -->
      <div class="card p-5 space-y-4">
        <p class="section-title">Información básica</p>

        <!-- Photo -->
        <div class="flex gap-4 items-start">
          <div class="flex-shrink-0">
            <div class="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center relative group cursor-pointer"
              (click)="photoInput.click()">
              @if (photoPreview()) {
                <img [src]="photoPreview()!" class="w-full h-full object-cover" alt="Foto" />
              } @else {
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v10.5A1.5 1.5 0 0 0 3.75 18Z" />
                </svg>
              }
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
              </div>
            </div>
            <input #photoInput type="file" accept="image/*" class="hidden"
              (change)="onPhotoSelected($event)" />
            @if (photoPreview()) {
              <button type="button" (click)="clearPhoto()"
                class="mt-1 text-xs text-red-500 hover:underline block text-center">Quitar</button>
            }
          </div>

          <div class="flex-1 space-y-3">
            <!-- Name -->
            <div>
              <label class="label">Nombre *</label>
              <input [(ngModel)]="form.name" name="name" required
                class="input-field w-full" placeholder="Ej. Pizza Margarita" />
            </div>
            <!-- Description -->
            <div>
              <label class="label">Descripción</label>
              <textarea [(ngModel)]="form.description" name="description" rows="2"
                class="input-field w-full resize-none" placeholder="Descripción breve..."></textarea>
            </div>
          </div>
        </div>

        <!-- Category + Display order -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Categoría</label>
            <select [(ngModel)]="form.category_id" name="category_id" class="input-field w-full">
              <option [value]="null">Sin categoría</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label">Orden de visualización</label>
            <input type="number" [(ngModel)]="form.display_order" name="display_order" min="0"
              class="input-field w-full" />
          </div>
        </div>

        <!-- Price -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Precio *</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input type="number" [(ngModel)]="form.price" name="price" required min="0" step="0.01"
                class="input-field w-full pl-7" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label class="label">Precio con descuento</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input type="number" [(ngModel)]="form.discount_price" name="discount_price" min="0" step="0.01"
                class="input-field w-full pl-7" placeholder="Opcional" />
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label class="label">Etiquetas</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            @for (tag of form.tags; track tag) {
              <span class="tag-chip">
                {{ tag }}
                <button type="button" (click)="removeTag(tag)" class="hover:text-red-600 ml-1">✕</button>
              </span>
            }
          </div>
          <input [(ngModel)]="tagInput" name="tagInput"
            (keydown.enter)="addTag(); $event.preventDefault()"
            (keydown.comma)="addTag(); $event.preventDefault()"
            placeholder="Escribe y presiona Enter para agregar..."
            class="input-field w-full text-sm" />
        </div>

        <!-- Toggles -->
        <div class="flex items-center gap-6">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.is_available" name="is_available"
              class="w-4 h-4 accent-pink-600" />
            <span class="text-sm font-medium text-gray-700">Disponible</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.is_featured" name="is_featured"
              class="w-4 h-4 accent-pink-600" />
            <span class="text-sm font-medium text-gray-700">Destacado</span>
          </label>
        </div>
      </div>

      <!-- ─── S2: Horario y límites ────────────────────────────── -->
      <div class="card p-5 space-y-4">
        <p class="section-title">Horario y límites</p>

        <!-- Hours -->
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.use_hours" name="use_hours"
              class="w-4 h-4 accent-pink-600" />
            <span class="text-sm font-medium text-gray-700">Disponible en horario específico</span>
          </label>
        </div>
        @if (form.use_hours) {
          <div class="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label class="label">Desde</label>
              <input type="time" [(ngModel)]="form.available_from" name="available_from"
                class="input-field w-full" />
            </div>
            <div>
              <label class="label">Hasta</label>
              <input type="time" [(ngModel)]="form.available_until" name="available_until"
                class="input-field w-full" />
            </div>
          </div>
        }

        <!-- Days -->
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.use_days" name="use_days"
              class="w-4 h-4 accent-pink-600" />
            <span class="text-sm font-medium text-gray-700">Solo en días específicos</span>
          </label>
        </div>
        @if (form.use_days) {
          <div class="flex gap-2 pl-6">
            @for (day of days; track day.key) {
              <button type="button"
                class="day-btn" [class.on]="form.available_days.includes(day.key)"
                (click)="toggleDay(day.key)">{{ day.label }}</button>
            }
          </div>
        }

        <!-- Max qty -->
        <div class="max-w-xs">
          <label class="label">Máx. cantidad por pedido</label>
          <input type="number" [(ngModel)]="form.max_qty_per_order" name="max_qty_per_order"
            min="1" class="input-field w-full" placeholder="Sin límite" />
        </div>
      </div>

      <!-- ─── S3: Campos por tipo de comercio ─────────────────── -->
      @if (commerceType() === 'restaurante') {
        <div class="card p-5 space-y-4">
          <p class="section-title">Opciones de menú</p>
          <div class="space-y-1">
            <label class="label">Tiempo de preparación: <strong>{{ form.preparation_time ?? 0 }} min</strong></label>
            <input type="range" [(ngModel)]="form.preparation_time" name="preparation_time"
              min="0" max="120" step="5" class="w-full accent-pink-600" />
            <div class="flex justify-between text-xs text-gray-400"><span>0 min</span><span>120 min</span></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Calorías (kcal)</label>
              <input type="number" [(ngModel)]="form.calories" name="calories"
                min="0" class="input-field w-full" placeholder="Opcional" />
            </div>
            <div class="flex items-center pt-5">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="form.is_combo" name="is_combo"
                  class="w-4 h-4 accent-pink-600" />
                <span class="text-sm font-medium text-gray-700">Es combo / combo meal</span>
              </label>
            </div>
          </div>
        </div>
      }

      @if (commerceType() === 'farmacia') {
        <div class="card p-5 space-y-4">
          <p class="section-title">Información farmacéutica</p>
          <div class="flex gap-6">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" [(ngModel)]="form.requires_prescription" name="requires_prescription"
                class="w-4 h-4 accent-pink-600" />
              <span class="text-sm font-medium text-gray-700">Requiere receta (Rx)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" [(ngModel)]="form.controlled_substance" name="controlled_substance"
                class="w-4 h-4 accent-pink-600" />
              <span class="text-sm font-medium text-gray-700">Sustancia controlada</span>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Marca / Laboratorio</label>
              <input [(ngModel)]="form.brand" name="brand" class="input-field w-full" placeholder="Ej. Bayer" />
            </div>
            <div>
              <label class="label">Unidad de medida</label>
              <select [(ngModel)]="form.unit_type" name="unit_type" class="input-field w-full">
                <option [value]="null">—</option>
                @for (u of unitTypes; track u) { <option [value]="u">{{ u }}</option> }
              </select>
            </div>
            <div>
              <label class="label">SKU / Código interno</label>
              <input [(ngModel)]="form.sku" name="sku" class="input-field w-full font-mono" placeholder="ABC-123" />
            </div>
            <div>
              <label class="label">Código de barras</label>
              <input [(ngModel)]="form.barcode" name="barcode" class="input-field w-full font-mono" placeholder="7501234567890" />
            </div>
          </div>
        </div>
      }

      @if (commerceType() === 'bodega' || commerceType() === 'colmado' || commerceType() === 'supermercado') {
        <div class="card p-5 space-y-4">
          <p class="section-title">Información del producto</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Marca</label>
              <input [(ngModel)]="form.brand" name="brand_gro" class="input-field w-full" placeholder="Ej. Nestlé" />
            </div>
            <div>
              <label class="label">Unidad de medida</label>
              <select [(ngModel)]="form.unit_type" name="unit_type_gro" class="input-field w-full">
                <option [value]="null">—</option>
                @for (u of unitTypes; track u) { <option [value]="u">{{ u }}</option> }
              </select>
            </div>
            <div>
              <label class="label">SKU</label>
              <input [(ngModel)]="form.sku" name="sku_gro" class="input-field w-full font-mono" placeholder="ABC-123" />
            </div>
            <div>
              <label class="label">Código de barras</label>
              <input [(ngModel)]="form.barcode" name="barcode_gro" class="input-field w-full font-mono" />
            </div>
          </div>
        </div>
      }

      @if (commerceType() === 'tienda_ropa' || commerceType() === 'electronica') {
        <div class="card p-5 space-y-4">
          <p class="section-title">{{ commerceType() === 'tienda_ropa' ? 'Tallas y colores' : 'Variantes' }}</p>
          <div class="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label class="label">SKU base</label>
              <input [(ngModel)]="form.sku" name="sku_var" class="input-field w-full font-mono" placeholder="BASE-001" />
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.has_variants" name="has_variants"
              class="w-4 h-4 accent-pink-600" />
            <span class="text-sm font-medium text-gray-700">Este producto tiene variantes</span>
          </label>
          @if (form.has_variants) {
            <app-variants-manager
              [initialVariants]="existingVariants()"
              [commerceType]="commerceType()"
              (variantsChange)="pendingVariants = $event" />
          }
        </div>
      }

      <!-- ─── S4: Inventario ──────────────────────────────────── -->
      @if (commerceType() !== 'restaurante') {
        <div class="card p-5 space-y-4">
          <p class="section-title">Control de inventario</p>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" [(ngModel)]="form.track_stock" name="track_stock"
              class="w-4 h-4 accent-pink-600" />
            <span class="text-sm font-medium text-gray-700">Rastrear stock de este producto</span>
          </label>
          @if (form.track_stock) {
            <div class="grid grid-cols-2 gap-3 pl-6">
              <div>
                <label class="label">Cantidad en stock</label>
                <input type="number" [(ngModel)]="form.stock_count" name="stock_count"
                  min="0" class="input-field w-full" placeholder="0" />
              </div>
              <div>
                <label class="label">Alerta de stock bajo</label>
                <input type="number" [(ngModel)]="form.low_stock_alert" name="low_stock_alert"
                  min="0" class="input-field w-full" placeholder="Ej. 5" />
              </div>
            </div>
          }
        </div>
      }

      <!-- Save button (bottom) -->
      <div class="flex justify-end gap-3 pb-8">
        <a routerLink="/store/catalog" class="btn-secondary px-5 py-2 text-sm">Cancelar</a>
        <button type="submit" [disabled]="isSaving()"
          class="btn-primary px-5 py-2 text-sm disabled:opacity-50">
          {{ isSaving() ? 'Guardando...' : (isEditMode() ? 'Guardar cambios' : 'Crear producto') }}
        </button>
      </div>
    </form>
  </div>
  `,
})
export class StoreProductFormPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly storeService = inject(StoreAdminService);
    private readonly catalogService = inject(StoreCatalogService);
    private readonly toast = inject(ToastService);

    readonly isLoading = signal(false);
    readonly isSaving = signal(false);
    readonly categories = signal<MenuCategory[]>([]);
    readonly existingVariants = signal<Partial<ProductVariant>[]>([]);
    readonly productId = signal<string | null>(null);
    readonly photoPreviewSignal = signal<string | null>(null);

    pendingVariants: Partial<ProductVariant>[] = [];
    tagInput = '';
    private photoFile: File | null = null;

    readonly unitTypes = UNIT_TYPES;
    readonly days = DAYS;

    form: ProductForm = {
        name: '', description: '', category_id: null,
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

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        const storeId = this.storeService.activeStoreId();
        if (storeId) {
            this.catalogService.getCategories(storeId).subscribe(cats => this.categories.set(cats));
        }
        if (id && id !== 'new') {
            this.productId.set(id);
            this.loadProduct(id);
        }
    }

    private loadProduct(id: string) {
        this.isLoading.set(true);
        this.catalogService.getProductById(id).subscribe({
            next: (p) => {
                this.form = {
                    name: p.name,
                    description: p.description ?? '',
                    category_id: p.category_id ?? null,
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
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar el producto');
                this.isLoading.set(false);
            },
        });
    }

    // ─── Tags ─────────────────────────────────────────────────────────────────
    addTag() {
        const tag = this.tagInput.replace(/,$/, '').trim();
        if (tag && !this.form.tags.includes(tag)) this.form.tags = [...this.form.tags, tag];
        this.tagInput = '';
    }

    removeTag(tag: string) {
        this.form.tags = this.form.tags.filter(t => t !== tag);
    }

    // ─── Days ─────────────────────────────────────────────────────────────────
    toggleDay(key: string) {
        this.form.available_days = this.form.available_days.includes(key)
            ? this.form.available_days.filter(d => d !== key)
            : [...this.form.available_days, key];
    }

    // ─── Photo ────────────────────────────────────────────────────────────────
    onPhotoSelected(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        this.photoFile = file;
        const url = URL.createObjectURL(file);
        this.photoPreviewSignal.set(url);
    }

    clearPhoto() {
        this.photoFile = null;
        this.photoPreviewSignal.set(null);
        if (this.form) (this.form as unknown as Record<string, unknown>)['photo_url'] = null;
    }

    // ─── Submit ───────────────────────────────────────────────────────────────
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
                photoUrl = await this.catalogService.uploadProductImage(this.photoFile, storeId);
            }

            const payload: Partial<MenuItem> = {
                name: this.form.name,
                description: this.form.description || null,
                category_id: this.form.category_id,
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

            // Save variants
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
}
