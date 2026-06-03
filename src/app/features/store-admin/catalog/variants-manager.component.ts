import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductVariant } from '../../../core/supabase/database.types';

export type DraftVariant = Omit<ProductVariant, 'id' | 'menu_item_id'> & { _tmpId: string };

const ROPA_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COMMON_COLORS = ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Rosa'];

@Component({
  selector: 'app-variants-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .var-row td { padding: 6px 8px; }
    input[type=number]::-webkit-inner-spin-button { opacity:1; }
    .gen-panel { animation: fadeIn 0.15s; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
  `],
  template: `
  <div class="space-y-3">
    <!-- Table of variants -->
    @if (variants().length > 0) {
      <div class="overflow-x-auto border border-gray-200 rounded-xl">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th class="px-3 py-2 text-left">Nombre</th>
              @if (isRopa()) {
                <th class="px-3 py-2 text-left">Talla</th>
                <th class="px-3 py-2 text-left">Color</th>
              }
              @if (isElectronica()) {
                <th class="px-3 py-2 text-left">Almacenam.</th>
                <th class="px-3 py-2 text-left">Color</th>
              }
              <th class="px-3 py-2 text-left">SKU</th>
              <th class="px-3 py-2 text-right">+/- Precio</th>
              <th class="px-3 py-2 text-right">Stock</th>
              <th class="px-3 py-2 text-center">Disp.</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @for (v of variants(); track v._tmpId; let i = $index) {
              <tr class="var-row hover:bg-gray-50">
                <td>
                  <input [(ngModel)]="v.name" (ngModelChange)="emit()"
                    class="input-field py-1 text-sm w-28" placeholder="Nombre" />
                </td>
                @if (isRopa()) {
                  <td>
                    <select [(ngModel)]="v.attributes['size']" (ngModelChange)="autoName(v); emit()"
                      class="input-field py-1 text-sm w-24">
                      <option value="">—</option>
                      @for (s of ropasSizes; track s) { <option [value]="s">{{ s }}</option>}
                    </select>
                  </td>
                  <td>
                    <input [(ngModel)]="v.attributes['color']" (ngModelChange)="autoName(v); emit()"
                      list="colorlist" class="input-field py-1 text-sm w-24" placeholder="Color" />
                    <datalist id="colorlist">
                      @for (c of commonColors; track c) { <option [value]="c">{{ c }}</option> }
                    </datalist>
                  </td>
                }
                @if (isElectronica()) {
                  <td>
                    <input [(ngModel)]="v.attributes['storage']" (ngModelChange)="autoName(v); emit()"
                      class="input-field py-1 text-sm w-24" placeholder="128GB" />
                  </td>
                  <td>
                    <input [(ngModel)]="v.attributes['color']" (ngModelChange)="autoName(v); emit()"
                      list="colorlist2" class="input-field py-1 text-sm w-24" placeholder="Color" />
                    <datalist id="colorlist2">
                      @for (c of commonColors; track c) { <option [value]="c">{{ c }}</option> }
                    </datalist>
                  </td>
                }
                <td>
                  <input [(ngModel)]="v.sku" (ngModelChange)="emit()"
                    class="input-field py-1 text-sm w-24 font-mono" placeholder="SKU" />
                </td>
                <td>
                  <input type="number" [(ngModel)]="v.price_modifier" (ngModelChange)="emit()"
                    step="0.01" class="input-field py-1 text-sm w-20 text-right" placeholder="0.00" />
                </td>
                <td>
                  <input type="number" [(ngModel)]="v.stock_count" (ngModelChange)="emit()"
                    min="0" class="input-field py-1 text-sm w-20 text-right" placeholder="—" />
                </td>
                <td class="text-center">
                  <input type="checkbox" [(ngModel)]="v.is_available" (ngModelChange)="emit()"
                    class="w-4 h-4 accent-pink-600" />
                </td>
                <td>
                  <button (click)="removeVariant(i)"
                    class="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
        No hay variantes. Agrega una o genera automáticamente.
      </div>
    }

    <!-- Actions -->
    <div class="flex items-center gap-2 flex-wrap">
      <button type="button" (click)="addVariant()"
        class="btn-secondary flex items-center gap-2 text-sm py-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Agregar variante
      </button>

      @if (isRopa() || isElectronica()) {
        <button type="button" (click)="toggleGenPanel()"
          class="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
          Generar variantes
        </button>
      }
    </div>

    <!-- Generator panel -->
    @if (showGenPanel()) {
      <div class="gen-panel border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
        @if (isRopa()) {
          <div>
            <p class="text-xs font-medium text-gray-600 mb-1">Tallas</p>
            <div class="flex gap-2 flex-wrap">
              @for (s of ropasSizes; track s) {
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" [checked]="selectedSizes().includes(s)"
                    (change)="toggleSize(s)"
                    class="accent-pink-600" />
                  {{ s }}
                </label>
              }
            </div>
          </div>
        }
        <div>
          <p class="text-xs font-medium text-gray-600 mb-1">Colores</p>
          <div class="flex gap-2 flex-wrap mb-1">
            @for (c of commonColors; track c) {
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" [checked]="selectedColors().includes(c)"
                  (change)="toggleColor(c)"
                  class="accent-pink-600" />
                {{ c }}
              </label>
            }
          </div>
          <div class="flex gap-1">
            <input [(ngModel)]="customColor" placeholder="Otro color..."
              class="input-field text-sm py-1 flex-1" (keyup.enter)="addCustomColor()" />
            <button type="button" (click)="addCustomColor()" class="btn-secondary text-sm px-3 py-1">+</button>
          </div>
        </div>
        @if (isElectronica()) {
          <div>
            <p class="text-xs font-medium text-gray-600 mb-1">Almacenamiento</p>
            <div class="flex gap-1">
              <input [(ngModel)]="storageInput" placeholder="64GB, 128GB..."
                class="input-field text-sm py-1 flex-1" (keyup.enter)="addStorage()" />
              <button type="button" (click)="addStorage()" class="btn-secondary text-sm px-3 py-1">+</button>
            </div>
            @if (selectedStorages().length > 0) {
              <div class="flex gap-1 mt-1 flex-wrap">
                @for (s of selectedStorages(); track s) {
                  <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    {{ s }}
                    <button type="button" (click)="removeStorage(s)" class="hover:text-red-500">✕</button>
                  </span>
                }
              </div>
            }
          </div>
        }
        <div class="flex justify-end gap-2">
          <button type="button" (click)="showGenPanel.set(false)" class="btn-secondary text-sm py-1">Cancelar</button>
          <button type="button" (click)="generateVariants()" class="btn-primary text-sm py-1">
            Generar {{ estimatedCount() }} variante(s)
          </button>
        </div>
      </div>
    }
  </div>
  `,
})
export class VariantsManagerComponent implements OnInit, OnChanges {
  @Input() initialVariants: Partial<ProductVariant>[] = [];
  @Input() commerceType: string = 'otro';
  @Output() variantsChange = new EventEmitter<Partial<ProductVariant>[]>();

  readonly variants = signal<DraftVariant[]>([]);
  readonly showGenPanel = signal(false);
  readonly selectedSizes = signal<string[]>([]);
  readonly selectedColors = signal<string[]>([]);
  readonly selectedStorages = signal<string[]>([]);

  customColor = '';
  storageInput = '';

  readonly ropasSizes = ROPA_SIZES;
  readonly commonColors = COMMON_COLORS;

  readonly isRopa = computed(() => this.commerceType === 'tienda_ropa');
  readonly isElectronica = computed(() => this.commerceType === 'electronica');

  readonly estimatedCount = computed(() => {
    if (this.isRopa()) {
      const s = Math.max(this.selectedSizes().length, 1);
      const c = Math.max(this.selectedColors().length, 1);
      return s * c;
    }
    if (this.isElectronica()) {
      const s = Math.max(this.selectedStorages().length, 1);
      const c = Math.max(this.selectedColors().length, 1);
      return s * c;
    }
    return 0;
  });

  ngOnInit() { this.loadInitial(); }
  ngOnChanges(ch: SimpleChanges) {
    if (ch['initialVariants']) this.loadInitial();
  }

  private loadInitial() {
    this.variants.set(
      (this.initialVariants ?? []).map(v => ({
        name: v.name ?? '',
        sku: v.sku ?? null,
        price_modifier: v.price_modifier ?? 0,
        stock_count: v.stock_count ?? null,
        photo_url: v.photo_url ?? null,
        is_available: v.is_available ?? true,
        attributes: v.attributes ?? {},
        _tmpId: crypto.randomUUID(),
      })),
    );
  }

  addVariant() {
    this.variants.update(list => [
      ...list,
      { name: '', sku: null, price_modifier: 0, stock_count: null, photo_url: null, is_available: true, attributes: {}, _tmpId: crypto.randomUUID() },
    ]);
  }

  removeVariant(i: number) {
    this.variants.update(list => list.filter((_, idx) => idx !== i));
    this.emit();
  }

  autoName(v: DraftVariant) {
    const parts: string[] = [];
    if (v.attributes['size']) parts.push(v.attributes['size']);
    if (v.attributes['storage']) parts.push(v.attributes['storage']);
    if (v.attributes['color']) parts.push(v.attributes['color']);
    if (parts.length > 0) v.name = parts.join(' / ');
  }

  emit() {
    this.variantsChange.emit(this.variants().map(v => ({
      name: v.name,
      sku: v.sku,
      price_modifier: v.price_modifier,
      stock_count: v.stock_count,
      is_available: v.is_available,
      attributes: { ...v.attributes },
    })));
  }

  toggleGenPanel() { this.showGenPanel.update(v => !v); }

  toggleSize(s: string) {
    this.selectedSizes.update(list =>
      list.includes(s) ? list.filter(x => x !== s) : [...list, s],
    );
  }

  toggleColor(c: string) {
    this.selectedColors.update(list =>
      list.includes(c) ? list.filter(x => x !== c) : [...list, c],
    );
  }

  addCustomColor() {
    const c = this.customColor.trim();
    if (!c) return;
    this.selectedColors.update(list => (list.includes(c) ? list : [...list, c]));
    this.customColor = '';
  }

  addStorage() {
    const s = this.storageInput.trim();
    if (!s) return;
    this.selectedStorages.update(list => (list.includes(s) ? list : [...list, s]));
    this.storageInput = '';
  }

  removeStorage(s: string) {
    this.selectedStorages.update(list => list.filter(x => x !== s));
  }

  generateVariants() {
    const newVariants: DraftVariant[] = [];

    if (this.isRopa()) {
      const sizes = this.selectedSizes().length ? this.selectedSizes() : [''];
      const colors = this.selectedColors().length ? this.selectedColors() : [''];
      for (const size of sizes) {
        for (const color of colors) {
          const parts = [size, color].filter(Boolean);
          newVariants.push({
            name: parts.join(' / '),
            sku: null, price_modifier: 0, stock_count: null, photo_url: null, is_available: true,
            attributes: { size, color },
            _tmpId: crypto.randomUUID(),
          });
        }
      }
    } else if (this.isElectronica()) {
      const storages = this.selectedStorages().length ? this.selectedStorages() : [''];
      const colors = this.selectedColors().length ? this.selectedColors() : [''];
      for (const storage of storages) {
        for (const color of colors) {
          const parts = [storage, color].filter(Boolean);
          newVariants.push({
            name: parts.join(' / '),
            sku: null, price_modifier: 0, stock_count: null, photo_url: null, is_available: true,
            attributes: { storage, color },
            _tmpId: crypto.randomUUID(),
          });
        }
      }
    }

    this.variants.update(list => [...list, ...newVariants]);
    this.showGenPanel.set(false);
    this.emit();
  }
}
