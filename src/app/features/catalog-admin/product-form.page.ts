import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
    CatalogAdminService, CatalogProduct, CreateProductData, ModerationStatus,
} from './services/catalog-admin.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { MenuCategory } from '../../core/supabase/database.types';

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

const MOD_OPTIONS: { value: ModerationStatus; label: string; icon: string; desc: string }[] = [
    { value: 'aprobado', label: 'Aprobado', icon: '✅', desc: 'Visible para todos los clientes' },
    { value: 'bajo_revision', label: 'Bajo revisión', icon: '⚠️', desc: 'Visible pero marcado internamente' },
    { value: 'retirado', label: 'Retirado', icon: '🔴', desc: 'Oculto — fuerza is_available=false' },
];

interface ProductForm {
    // Basic
    name: string;
    description: string;
    category_id: string;
    price: number;
    discount_price: number | null;
    photo_url: string;
    is_available: boolean;
    is_featured: boolean;
    tags: string[];
    // Stock
    track_stock: boolean;
    stock_count: number | null;
    low_stock_alert: number | null;
    sku: string;
    // Superadmin price controls
    in_venue_price: number | null;
    // Moderation
    moderation_status: ModerationStatus;
    moderation_notes: string;
    // Dietary
    dietary_tags: string[];
    // Options
    notify_store: boolean;
}

function emptyForm(): ProductForm {
    return {
        name: '', description: '', category_id: '', price: 0, discount_price: null,
        photo_url: '', is_available: true, is_featured: false, tags: [],
        track_stock: false, stock_count: null, low_stock_alert: null, sku: '',
        in_venue_price: null, moderation_status: 'aprobado',
        moderation_notes: '', dietary_tags: [], notify_store: true,
    };
}

@Component({
    selector: 'app-product-form',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
    template: `
<!-- Breadcrumb -->
<div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
  <a routerLink="/catalog" class="hover:text-primary-600 transition-colors">Catálogos</a>
  <span>›</span>
  <a [routerLink]="['/catalog', storeId]" class="hover:text-primary-600 transition-colors">{{ storeId | slice:0:8 }}…</a>
  <span>›</span>
  <span class="font-medium text-gray-800">{{ isNew ? 'Nuevo producto' : 'Editar producto' }}</span>
</div>

<div class="max-w-3xl mx-auto space-y-5">

  <!-- ═══ SECCIÓN 1: Info básica ════════════════════════════════════════════ -->
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="px-5 py-3 bg-gray-50 border-b border-gray-200">
      <h3 class="text-sm font-bold text-gray-700">📦 Información básica</h3>
    </div>
    <div class="p-5 space-y-4">

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="label text-xs mb-1 block">Nombre del producto *</label>
          <input type="text" class="input-field text-sm" placeholder="Ej: Hamburguesa clásica"
                 [(ngModel)]="form.name" maxlength="120" />
        </div>

        <div class="sm:col-span-2">
          <label class="label text-xs mb-1 block">Descripción</label>
          <textarea class="input-field text-sm resize-none" rows="3"
                    placeholder="Describe el producto…" [(ngModel)]="form.description"></textarea>
        </div>

        <div>
          <label class="label text-xs mb-1 block">Categoría</label>
          <select class="input-field text-sm" [(ngModel)]="form.category_id">
            <option value="">Sin categoría</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>

        <div>
          <label class="label text-xs mb-1 block">URL de la foto</label>
          <input type="url" class="input-field text-sm" placeholder="https://…"
                 [(ngModel)]="form.photo_url" />
        </div>
      </div>

      <div class="flex flex-wrap gap-4">
        <label class="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" class="rounded" [(ngModel)]="form.is_available" />
          <span>Disponible</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" class="rounded" [(ngModel)]="form.is_featured" />
          <span>⭐ Destacado</span>
        </label>
      </div>
    </div>
  </div>

  <!-- ═══ SECCIÓN 2: Stock ═════════════════════════════════════════════════ -->
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="px-5 py-3 bg-gray-50 border-b border-gray-200">
      <h3 class="text-sm font-bold text-gray-700">📊 Control de stock</h3>
    </div>
    <div class="p-5">
      <label class="flex items-center gap-2 cursor-pointer text-sm mb-4">
        <input type="checkbox" class="rounded" [(ngModel)]="form.track_stock" />
        <span>Controlar stock de este producto</span>
      </label>

      @if (form.track_stock) {
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="label text-xs mb-1 block">Stock actual</label>
            <input type="number" class="input-field text-sm" [(ngModel)]="form.stock_count" min="0" />
          </div>
          <div>
            <label class="label text-xs mb-1 block">Alerta bajo stock</label>
            <input type="number" class="input-field text-sm" [(ngModel)]="form.low_stock_alert" min="0" />
          </div>
          <div>
            <label class="label text-xs mb-1 block">SKU</label>
            <input type="text" class="input-field text-sm" [(ngModel)]="form.sku" />
          </div>
        </div>
      }
    </div>
  </div>

  <!-- ═══ SECCIÓN 3 (SUPERADMIN): Control de precios ═══════════════════════ -->
  <div class="bg-white border-2 border-warning-300 rounded-xl overflow-hidden">
    <div class="px-5 py-3 bg-warning-50 border-b border-warning-200">
      <h3 class="text-sm font-bold text-warning-800">💰 Control de precios Tutty</h3>
      <p class="text-xs text-warning-600 mt-0.5">Solo visible para el equipo de Tutty</p>
    </div>
    <div class="p-5 space-y-4">

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="label text-xs mb-1 block">Precio en la app (RD$) *</label>
          <input type="number" class="input-field text-sm" [(ngModel)]="form.price" min="0" step="0.01" />
          @if (form.in_venue_price && form.price > form.in_venue_price) {
            <p class="text-xs text-warning-600 mt-1 flex items-center gap-1">
              <span>⚠️</span> Mayor que precio en sala
            </p>
          }
        </div>
        <div>
          <label class="label text-xs mb-1 block">Precio con descuento (RD$)</label>
          <input type="number" class="input-field text-sm" [(ngModel)]="form.discount_price" min="0" step="0.01" />
          @if (discountPct() !== null) {
            <p class="text-xs text-success-600 mt-1 font-medium">{{ discountPct() }}% desc.</p>
          }
        </div>
        <div>
          <label class="label text-xs mb-1 block">
            Precio en sala (RD$)
            <span class="font-normal text-gray-400 ml-1">— ref. local</span>
          </label>
          <input type="number" class="input-field text-sm" [(ngModel)]="form.in_venue_price" min="0" step="0.01" />
        </div>
      </div>

      <!-- Pending price info (edit mode) -->
      @if (existingProduct()?.price_pending != null) {
        <div class="p-4 bg-warning-50 border border-warning-200 rounded-xl">
          <div class="flex items-start gap-2 mb-2">
            <span class="text-lg">⚠️</span>
            <div>
              <p class="text-sm font-semibold text-warning-800">El comercio propone cambiar el precio</p>
              <p class="text-sm text-warning-700">
                De RD\${{ existingProduct()!.price | number:'1.0-0' }}
                → RD\${{ existingProduct()!.price_pending | number:'1.0-0' }}
                <span class="font-bold">({{ existingProduct()!.price_change_pct! > 0 ? '+' : '' }}{{ existingProduct()!.price_change_pct }}%)</span>
              </p>
            </div>
          </div>
          @if (existingProduct()!.price_pending_notes) {
            <p class="text-xs text-warning-700 mb-3">
              <span class="font-medium">Nota:</span> {{ existingProduct()!.price_pending_notes }}
            </p>
          }
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white text-xs font-semibold rounded-lg transition-colors"
              (click)="approvePrice()"
              [disabled]="priceActionBusy()"
            >✅ Aprobar precio</button>
            <button
              class="px-3 py-1.5 bg-error-600 hover:bg-error-700 text-white text-xs font-semibold rounded-lg transition-colors"
              (click)="showPriceRejectInput.set(!showPriceRejectInput())"
            >❌ Rechazar</button>
            <button
              class="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg transition-colors hover:bg-gray-50"
              (click)="useProposedPrice()"
            >✏️ Usar este precio</button>
          </div>
          @if (showPriceRejectInput()) {
            <div class="mt-3">
              <input type="text" class="input-field text-xs w-full mt-1"
                     [(ngModel)]="priceRejectReason"
                     placeholder="Motivo del rechazo (obligatorio)" />
              <button
                class="mt-2 px-3 py-1.5 bg-error-600 text-white text-xs font-semibold rounded-lg"
                (click)="rejectPrice()"
                [disabled]="!priceRejectReason.trim() || priceActionBusy()"
              >Confirmar rechazo</button>
            </div>
          }
        </div>
      }
    </div>
  </div>

  <!-- ═══ SECCIÓN 4 (SUPERADMIN): Moderación ══════════════════════════════ -->
  <div class="bg-white border-2 border-gray-300 rounded-xl overflow-hidden">
    <div class="px-5 py-3 bg-gray-50 border-b border-gray-200">
      <h3 class="text-sm font-bold text-gray-700">🔍 Moderación</h3>
    </div>
    <div class="p-5 space-y-4">
      <div class="grid grid-cols-3 gap-2">
        @for (opt of modOptions; track opt.value) {
          <button
            class="flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs"
            [class]="form.moderation_status === opt.value
              ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'"
            (click)="form.moderation_status = opt.value"
            type="button"
          >
            <span class="text-xl">{{ opt.icon }}</span>
            <span class="font-medium">{{ opt.label }}</span>
            <span class="text-center leading-tight text-[10px] opacity-70">{{ opt.desc }}</span>
          </button>
        }
      </div>

      @if (form.moderation_status !== 'aprobado') {
        <div>
          <label class="label text-xs mb-1 block">Notas de moderación *</label>
          <textarea class="input-field text-sm resize-none" rows="2"
                    placeholder="El comercio recibirá estas notas en la notificación"
                    [(ngModel)]="form.moderation_notes"></textarea>
        </div>
      }
    </div>
  </div>

  <!-- ═══ SECCIÓN 5 (SUPERADMIN): Etiquetas dietéticas ═══════════════════ -->
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div class="px-5 py-3 bg-gray-50 border-b border-gray-200">
      <h3 class="text-sm font-bold text-gray-700">🥗 Etiquetas dietéticas</h3>
    </div>
    <div class="p-5">
      <div class="flex flex-wrap gap-2">
        @for (tag of dietaryTags; track tag.key) {
          <button
            class="px-3 py-1.5 rounded-full border-2 text-sm transition-all"
            [class]="form.dietary_tags.includes(tag.key)
              ? 'border-success-500 bg-success-50 text-success-700 font-semibold'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'"
            (click)="toggleDietaryTag(tag.key)"
            type="button"
          >{{ tag.label }}</button>
        }
      </div>
    </div>
  </div>

  <!-- ═══ FOOTER ══════════════════════════════════════════════════════════ -->
  <div class="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
    <label class="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" class="rounded" [(ngModel)]="form.notify_store" />
      <span class="text-gray-600">Notificar al comercio sobre estos cambios</span>
    </label>

    <div class="flex gap-3">
      <a [routerLink]="['/catalog', storeId]" class="btn-secondary text-sm">Cancelar</a>

      @if (isNew) {
        <button
          class="btn-secondary text-sm"
          (click)="submit(false)"
          [disabled]="saving()"
        >Guardar como borrador</button>
        <button
          class="btn-primary text-sm"
          (click)="submit(true)"
          [disabled]="saving() || !canSubmit()"
        >
          {{ saving() ? 'Guardando…' : 'Guardar y publicar' }}
        </button>
      } @else {
        <button
          class="btn-primary text-sm"
          (click)="submit(true)"
          [disabled]="saving() || !canSubmit()"
        >
          {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      }
    </div>
  </div>

</div>
    `,
})
export class ProductFormPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly svc = inject(CatalogAdminService);
    private readonly toast = inject(ToastService);

    storeId = '';
    productId = '';
    isNew = true;

    form: ProductForm = emptyForm();

    readonly categories = signal<MenuCategory[]>([]);
    readonly existingProduct = signal<CatalogProduct | null>(null);
    readonly saving = signal(false);
    readonly priceActionBusy = signal(false);
    readonly showPriceRejectInput = signal(false);
    priceRejectReason = '';

    readonly modOptions = MOD_OPTIONS;
    readonly dietaryTags = DIETARY_TAGS;

    readonly discountPct = computed(() => {
        if (!this.form.discount_price || !this.form.price) return null;
        return Math.round((1 - this.form.discount_price / this.form.price) * 100);
    });

    ngOnInit(): void {
        this.storeId = this.route.snapshot.paramMap.get('storeId') ?? '';
        this.productId = this.route.snapshot.paramMap.get('productId') ?? '';
        this.isNew = !this.productId || this.productId === 'new';

        this.svc.getCategories(this.storeId).subscribe({ next: cats => this.categories.set(cats) });

        if (!this.isNew) {
            this.svc.getProduct(this.productId).subscribe({
                next: p => {
                    this.existingProduct.set(p);
                    this.form = {
                        name: p.name,
                        description: p.description ?? '',
                        category_id: p.category_id ?? '',
                        price: p.price,
                        discount_price: p.discount_price ?? null,
                        photo_url: p.photo_url ?? '',
                        is_available: p.is_available,
                        is_featured: p.is_featured,
                        tags: p.tags ?? [],
                        track_stock: p.track_stock,
                        stock_count: p.stock_count ?? null,
                        low_stock_alert: p.low_stock_alert ?? null,
                        sku: p.sku ?? '',
                        in_venue_price: p.in_venue_price ?? null,
                        moderation_status: p.moderation_status,
                        moderation_notes: '',
                        dietary_tags: (p as any).dietary_tags ?? [],
                        notify_store: false,
                    };
                },
            });
        }
    }

    canSubmit(): boolean {
        return this.form.name.trim().length > 0 && this.form.price >= 0;
    }

    toggleDietaryTag(key: string): void {
        const tags = this.form.dietary_tags;
        if (tags.includes(key)) {
            this.form = { ...this.form, dietary_tags: tags.filter(t => t !== key) };
        } else {
            this.form = { ...this.form, dietary_tags: [...tags, key] };
        }
    }

    async submit(publish: boolean): Promise<void> {
        if (!this.canSubmit() || this.saving()) return;
        this.saving.set(true);

        const data: CreateProductData & { notify_store: boolean } = {
            name: this.form.name.trim(),
            description: this.form.description.trim() || undefined,
            category_id: this.form.category_id || undefined,
            price: this.form.price,
            discount_price: this.form.discount_price ?? undefined,
            photo_url: this.form.photo_url.trim() || undefined,
            is_available: publish ? this.form.is_available : false,
            is_featured: this.form.is_featured,
            tags: this.form.tags,
            track_stock: this.form.track_stock,
            stock_count: this.form.track_stock ? (this.form.stock_count ?? undefined) : undefined,
            low_stock_alert: this.form.track_stock ? (this.form.low_stock_alert ?? undefined) : undefined,
            sku: this.form.sku.trim() || undefined,
            in_venue_price: this.form.in_venue_price ?? undefined,
            moderation_status: this.form.moderation_status,
            dietary_tags: this.form.dietary_tags,
            notify_store: this.form.notify_store,
        };

        try {
            if (this.isNew) {
                const { product, error } = await this.svc.createProduct(this.storeId, data);
                if (error) { this.toast.error(error); return; }
                this.toast.success(`✅ Producto "${product!.name}" creado`);
                this.router.navigate(['/catalog', this.storeId]);
            } else {
                const { error } = await this.svc.updateProduct(this.productId, { ...data } as any);
                if (error) { this.toast.error(error); return; }
                // Apply moderation if changed
                if (this.form.moderation_status !== this.existingProduct()?.moderation_status) {
                    await this.svc.moderateProduct(this.productId, this.form.moderation_status, this.form.moderation_notes, this.form.notify_store);
                }
                this.toast.success('Cambios guardados');
                this.router.navigate(['/catalog', this.storeId]);
            }
        } catch {
            this.toast.error('Error al guardar el producto');
        } finally {
            this.saving.set(false);
        }
    }

    useProposedPrice(): void {
        const p = this.existingProduct();
        if (p?.price_pending) this.form = { ...this.form, price: p.price_pending };
    }

    async approvePrice(): Promise<void> {
        const p = this.existingProduct();
        if (!p) return;
        this.priceActionBusy.set(true);
        try {
            await this.svc.approvePendingPrice(p.id);
            this.toast.success('✅ Precio aprobado');
            this.existingProduct.update(prev => prev ? { ...prev, price: prev.price_pending!, price_pending: undefined } : prev);
        } catch {
            this.toast.error('Error al aprobar precio');
        } finally {
            this.priceActionBusy.set(false);
        }
    }

    async rejectPrice(): Promise<void> {
        const p = this.existingProduct();
        if (!p || !this.priceRejectReason.trim()) return;
        this.priceActionBusy.set(true);
        try {
            await this.svc.rejectPendingPrice(p.id, this.priceRejectReason.trim());
            this.toast.success('Precio rechazado');
            this.showPriceRejectInput.set(false);
            this.existingProduct.update(prev => prev ? { ...prev, price_pending: undefined } : prev);
        } catch {
            this.toast.error('Error al rechazar precio');
        } finally {
            this.priceActionBusy.set(false);
        }
    }
}
