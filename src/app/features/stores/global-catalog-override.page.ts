import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoresService } from './stores.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Restaurant, MenuItem, MenuCategory, CommerceType } from '../../core/supabase/database.types';
import { COMMERCE_ICONS, COMMERCE_LABELS } from './stores.page';

type ModerationTag = 'verificado' | 'destacado_plataforma' | 'bajo_revision';

interface OverridePending {
    itemId: string;
    is_available?: boolean;
    tags?: string[];
    reason: string;
}

@Component({
    selector: 'app-global-catalog-override',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
    template: `
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <a routerLink="/stores" class="hover:text-gray-700">Comercios</a>
      <span>/</span>
      @if (store()) {
        <a [routerLink]="['/stores', store()!.id]" class="hover:text-gray-700">{{ store()!.name }}</a>
        <span>/</span>
      }
      <span class="text-gray-800 font-medium">Catálogo</span>
    </div>

    @if (loading()) {
      <div class="space-y-3">
        @for (i of [1,2,3,4]; track i) {
          <div class="h-14 bg-gray-100 rounded-xl animate-pulse"></div>
        }
      </div>
    } @else {
      <!-- Store header -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-3">
        <div class="text-2xl">{{ store() ? icon(store()!.commerce_type) : '🏪' }}</div>
        <div>
          <h1 class="font-bold text-gray-900">{{ store()?.name }}</h1>
          <p class="text-xs text-gray-400">{{ store() ? label(store()!.commerce_type) : '' }} · Gestión de catálogo</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-4">
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="search" class="input-field pl-9" placeholder="Buscar producto..."
            [(ngModel)]="searchText" />
        </div>
        <select class="input-field w-44" [(ngModel)]="availabilityFilter">
          <option value="">Todos</option>
          <option value="available">Solo disponibles</option>
          <option value="unavailable">No disponibles</option>
        </select>
        <select class="input-field w-48" [(ngModel)]="tagFilter">
          <option value="">Todos los tags</option>
          <option value="verificado">✓ Verificado</option>
          <option value="destacado_plataforma">⭐ Destacado</option>
          <option value="bajo_revision">⚠ Bajo revisión</option>
        </select>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Precio</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Disponible</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tags moderación</th>
                @if (store()?.commerce_type === 'farmacia') {
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marca / Código</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receta / Ctrl.</th>
                }
                @if (store()?.commerce_type === 'bodega' || store()?.commerce_type === 'colmado') {
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unidad / Stock</th>
                }
                @if (store()?.commerce_type === 'tienda_ropa' || store()?.commerce_type === 'electronica') {
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Variantes</th>
                }
                @if (store()?.commerce_type === 'restaurante') {
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prep. / Cal.</th>
                }
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              @if (filteredItems().length === 0) {
                <tr>
                  <td colspan="8" class="px-4 py-12 text-center text-gray-400 text-sm">Sin productos</td>
                </tr>
              } @else {
                @for (item of filteredItems(); track item.id) {
                  <tr class="hover:bg-gray-50 transition-colors"
                    [class.opacity-60]="!item.is_available">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        @if (item.photo_url) {
                          <img [src]="item.photo_url" class="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        } @else {
                          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-lg flex-shrink-0">
                            {{ icon(store()?.commerce_type ?? 'otro') }}
                          </div>
                        }
                        <div>
                          <p class="font-medium text-gray-800">{{ item.name }}</p>
                          @if (item.sku) { <p class="text-xs text-gray-400 font-mono">SKU: {{ item.sku }}</p> }
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      <p class="font-medium text-gray-800">RD$ {{ item.price | number:'1.0-0' }}</p>
                      @if (item.discount_price) {
                        <p class="text-xs text-success-600">Oferta: RD$ {{ item.discount_price | number:'1.0-0' }}</p>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        [class]="item.is_available ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-600'">
                        {{ item.is_available ? 'Disponible' : 'No disponible' }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-1">
                        @for (tag of getModerationTags(item); track tag) {
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            [class]="tagStyle(tag)">{{ tagEmoji(tag) }} {{ tag }}</span>
                        }
                        @if (getModerationTags(item).length === 0) {
                          <span class="text-gray-300 text-xs">—</span>
                        }
                      </div>
                    </td>
                    @if (store()?.commerce_type === 'farmacia') {
                      <td class="px-4 py-3 text-xs text-gray-600">
                        <p>{{ item.brand ?? '—' }}</p>
                        <p class="font-mono">{{ item.barcode ?? '—' }}</p>
                      </td>
                      <td class="px-4 py-3 text-xs">
                        <p>Receta: {{ item.requires_prescription ? '✓' : '—' }}</p>
                        <p>Ctrl.: {{ item.controlled_substance ? '⚠️' : '—' }}</p>
                      </td>
                    }
                    @if (store()?.commerce_type === 'bodega' || store()?.commerce_type === 'colmado') {
                      <td class="px-4 py-3 text-xs text-gray-600">
                        <p>{{ item.unit_type }}</p>
                        <p>Stock: {{ item.stock_count ?? '∞' }}</p>
                      </td>
                    }
                    @if (store()?.commerce_type === 'tienda_ropa' || store()?.commerce_type === 'electronica') {
                      <td class="px-4 py-3 text-xs">{{ item.has_variants ? '✓ Sí' : '—' }}</td>
                    }
                    @if (store()?.commerce_type === 'restaurante') {
                      <td class="px-4 py-3 text-xs text-gray-600">
                        <p>{{ item.preparation_time ?? 15 }} min</p>
                        <p>{{ item.calories ?? '—' }} kcal</p>
                      </td>
                    }
                    <td class="px-4 py-3">
                      <button class="btn-secondary text-xs px-2.5 py-1"
                        (click)="openOverride(item)">Moderar</button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        @if (items().length > 0) {
          <div class="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {{ filteredItems().length }} de {{ items().length }} productos
          </div>
        }
      </div>
    }

    <!-- Override Modal -->
    @if (overrideItem()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="closeOverride()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-1">Moderación de producto</h3>
          <p class="text-sm text-gray-500 mb-4 truncate">{{ overrideItem()!.name }}</p>

          <div class="space-y-5">
            <!-- Toggle availability -->
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p class="text-sm font-medium text-gray-700">Disponibilidad</p>
                <p class="text-xs text-gray-400">Oculta el producto para los clientes</p>
              </div>
              <button
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                [class]="overrideAvailable() ? 'bg-success-500' : 'bg-gray-300'"
                (click)="overrideAvailable.set(!overrideAvailable())"
              >
                <span class="inline-block w-5 h-5 transform rounded-full bg-white shadow transition-transform"
                  [class]="overrideAvailable() ? 'translate-x-5' : 'translate-x-0.5'"></span>
              </button>
            </div>

            <!-- Tags -->
            <div>
              <p class="text-sm font-medium text-gray-700 mb-2">Tags de moderación</p>
              <div class="flex flex-wrap gap-2">
                @for (tag of allModerationTags; track tag) {
                  <button type="button"
                    class="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                    [class]="selectedTags().includes(tag)
                      ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
                    (click)="toggleTag(tag)">
                    {{ tagEmoji(tag) }} {{ tag }}
                  </button>
                }
              </div>
            </div>

            <!-- Reason -->
            <div>
              <label class="label text-xs">Motivo de la acción *</label>
              <textarea class="input-field resize-none w-full" rows="3"
                placeholder="Explica por qué estás haciendo este cambio..."
                [(ngModel)]="overrideReason"></textarea>
            </div>
          </div>

          <div class="flex gap-3 mt-5 justify-end">
            <button class="btn-secondary" (click)="closeOverride()">Cancelar</button>
            <button class="btn-primary" (click)="applyOverride()"
              [disabled]="!overrideReason.trim() || overrideSaving()">
              {{ overrideSaving() ? 'Aplicando...' : 'Aplicar cambios' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GlobalCatalogOverrideComponent implements OnInit {
    private readonly service = inject(StoresService);
    private readonly toast = inject(ToastService);
    private readonly route = inject(ActivatedRoute);
    readonly router = inject(Router);

    readonly store = signal<Restaurant | null>(null);
    readonly items = signal<MenuItem[]>([]);
    readonly loading = signal(true);
    readonly overrideItem = signal<MenuItem | null>(null);
    readonly overrideAvailable = signal(true);
    readonly selectedTags = signal<string[]>([]);
    readonly overrideSaving = signal(false);

    searchText = '';
    availabilityFilter = '';
    tagFilter = '';
    overrideReason = '';

    readonly allModerationTags: ModerationTag[] = ['verificado', 'destacado_plataforma', 'bajo_revision'];

    readonly filteredItems = () => {
        let list = this.items();
        if (this.searchText) {
            const q = this.searchText.toLowerCase();
            list = list.filter(i => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
        }
        if (this.availabilityFilter === 'available') list = list.filter(i => i.is_available);
        if (this.availabilityFilter === 'unavailable') list = list.filter(i => !i.is_available);
        if (this.tagFilter) list = list.filter(i => i.tags?.includes(this.tagFilter));
        return list;
    };

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id')!;
        this.service.getStoreById(id).subscribe({
            next: (s) => { this.store.set(s); },
        });
        this.service.getMenuItems(id).subscribe({
            next: (data) => { this.items.set(data); this.loading.set(false); },
            error: () => { this.toast.error('Error al cargar productos'); this.loading.set(false); },
        });
    }

    openOverride(item: MenuItem): void {
        this.overrideItem.set(item);
        this.overrideAvailable.set(item.is_available);
        this.selectedTags.set(this.getModerationTags(item));
        this.overrideReason = '';
    }

    closeOverride(): void { this.overrideItem.set(null); }

    toggleTag(tag: string): void {
        this.selectedTags.update(tags =>
            tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
        );
    }

    async applyOverride(): Promise<void> {
        if (!this.overrideReason.trim()) return;
        this.overrideSaving.set(true);
        const item = this.overrideItem()!;
        const nonModerationTags = (item.tags ?? []).filter(t => !(this.allModerationTags as string[]).includes(t));
        const newTags = [...nonModerationTags, ...this.selectedTags()];
        try {
            await this.service.updateItemModeration(item.id, {
                is_available: this.overrideAvailable(),
                tags: newTags,
            });
            this.items.update(list => list.map(i => i.id === item.id
                ? { ...i, is_available: this.overrideAvailable(), tags: newTags }
                : i
            ));
            this.toast.success('Cambios aplicados');
            this.closeOverride();
        } catch {
            this.toast.error('Error al aplicar cambios');
        } finally {
            this.overrideSaving.set(false);
        }
    }

    getModerationTags(item: MenuItem): string[] {
        return (item.tags ?? []).filter(t => (this.allModerationTags as string[]).includes(t));
    }

    tagStyle(tag: string): string {
        const styles: Record<string, string> = {
            verificado: 'bg-success-100 text-success-700',
            destacado_plataforma: 'bg-brand-100 text-brand-600',
            bajo_revision: 'bg-warning-100 text-warning-700',
        };
        return styles[tag] ?? 'bg-gray-100 text-gray-600';
    }

    tagEmoji(tag: string): string {
        const emojis: Record<string, string> = {
            verificado: '✓',
            destacado_plataforma: '⭐',
            bajo_revision: '⚠',
        };
        return emojis[tag] ?? '';
    }

    icon(type: CommerceType | string): string { return COMMERCE_ICONS[type] ?? '🏪'; }
    label(type: CommerceType | string): string { return COMMERCE_LABELS[type] ?? type; }
}
