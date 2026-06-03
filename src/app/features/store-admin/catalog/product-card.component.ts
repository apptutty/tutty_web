import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuItem } from '../../../core/supabase/database.types';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .card-hover { transition: box-shadow 0.15s; }
    .card-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
    .toggle { position:relative; display:inline-block; width:40px; height:22px; }
    .toggle input { opacity:0; width:0; height:0; }
    .slider { position:absolute; inset:0; background:#d1d5db; border-radius:22px; transition:.3s; cursor:pointer; }
    .slider:before { content:''; position:absolute; height:16px; width:16px; left:3px; bottom:3px; background:white; border-radius:50%; transition:.3s; }
    input:checked + .slider { background:#e91e8c; }
    input:checked + .slider:before { transform:translateX(18px); }
  `],
  template: `
    <div class="card card-hover bg-white rounded-xl overflow-hidden flex flex-col">
      <!-- Thumbnail -->
      <div class="relative h-40 bg-gray-100 flex-shrink-0">
        @if (product.photo_url) {
          <img [src]="product.photo_url" [alt]="product.name"
               class="w-full h-full object-cover" loading="lazy" />
        } @else {
          <div class="w-full h-full flex items-center justify-center text-gray-300">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v10.5A1.5 1.5 0 0 0 3.75 18Z" />
            </svg>
          </div>
        }
        <!-- Badges top-left -->
        <div class="absolute top-2 left-2 flex flex-col gap-1">
          @if (product.is_featured) {
            <span class="px-2 py-0.5 bg-amber-400 text-white text-xs font-bold rounded-full">Destacado</span>
          }
          @if (product.is_combo) {
            <span class="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">Combo</span>
          }
          @if (product.has_variants) {
            <span class="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">Variantes</span>
          }
          @if (product.requires_prescription) {
            <span class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">Rx</span>
          }
          @if (product.controlled_substance) {
            <span class="px-2 py-0.5 bg-orange-600 text-white text-xs font-bold rounded-full">Controlado</span>
          }
        </div>
        <!-- Stock badge -->
        @if (product.track_stock) {
          <div class="absolute top-2 right-2">
            @if ((product.stock_count ?? 0) === 0) {
              <span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Sin stock</span>
            } @else if (product.low_stock_alert && (product.stock_count ?? 0) <= product.low_stock_alert) {
              <span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                Stock bajo ({{ product.stock_count }})
              </span>
            } @else {
              <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                Stock: {{ product.stock_count }}
              </span>
            }
          </div>
        }
      </div>

      <!-- Body -->
      <div class="p-3 flex flex-col flex-1 gap-2">
        <div class="flex-1">
          @if (categoryName) {
            <p class="text-xs text-gray-400 mb-0.5">{{ categoryName }}</p>
          }
          <h3 class="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{{ product.name }}</h3>

          <!-- Type-specific meta -->
          <div class="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
            @if (commerceType === 'restaurante') {
              @if (product.preparation_time) {
                <span>⏱ {{ product.preparation_time }} min</span>
              }
              @if (product.calories) {
                <span>🔥 {{ product.calories }} kcal</span>
              }
            }
            @if (commerceType === 'farmacia' || commerceType === 'bodega' || commerceType === 'colmado' || commerceType === 'supermercado') {
              @if (product.brand) { <span>{{ product.brand }}</span> }
              @if (product.sku) { <span class="font-mono">SKU: {{ product.sku }}</span> }
              @if (product.unit_type) { <span>{{ product.unit_type }}</span> }
            }
            @if (commerceType === 'tienda_ropa' || commerceType === 'electronica') {
              @if (product.sku) { <span class="font-mono">SKU: {{ product.sku }}</span> }
            }
          </div>
        </div>

        <!-- Pricing -->
        <div class="flex items-center gap-2">
          <span class="text-base font-bold text-gray-900">
            \${{ product.discount_price ?? product.price | number:'1.2-2' }}
          </span>
          @if (product.discount_price && product.discount_price < product.price) {
            <span class="text-sm text-gray-400 line-through">
              \${{ product.price | number:'1.2-2' }}
            </span>
            <span class="text-xs text-green-600 font-medium">
              -{{ discountPct() }}%
            </span>
          }
        </div>

        <!-- Footer: toggle + actions -->
        <div class="flex items-center justify-between pt-1 border-t border-gray-100">
          <label class="toggle" title="{{ product.is_available ? 'Disponible' : 'No disponible' }}">
            <input type="checkbox" [checked]="product.is_available"
              (change)="toggleAvailability.emit({ id: product.id, val: !product.is_available })" />
            <span class="slider"></span>
          </label>
          <div class="flex items-center gap-1">
            <button (click)="editProduct.emit(product.id)"
              class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
            <button (click)="deleteProduct.emit(product.id)"
              class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProductCardComponent {
  @Input() product!: MenuItem;
  @Input() commerceType: string = 'otro';
  @Input() categoryName?: string;

  @Output() toggleAvailability = new EventEmitter<{ id: string; val: boolean }>();
  @Output() editProduct = new EventEmitter<string>();
  @Output() deleteProduct = new EventEmitter<string>();

  discountPct(): number {
    if (!this.product.discount_price) return 0;
    return Math.round((1 - this.product.discount_price / this.product.price) * 100);
  }
}
