import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { CommerceType } from '../../../core/supabase/database.types';

type CommerceFilter = 'todos' | CommerceType;

interface Commerce {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    banner_url: string | null;
    is_open: boolean;
    avg_rating: number;
    total_reviews: number;
    avg_delivery_time: number | null;
    min_order_amount: number;
    commerce_type: CommerceType;
    delivery_available: boolean;
    pickup_available: boolean;
    is_featured: boolean;
    free_delivery_threshold: number | null;
}

const COMMERCE_FILTERS: { value: CommerceFilter; label: string; emoji: string }[] = [
    { value: 'todos', label: 'Todo', emoji: '🛒' },
    { value: 'restaurante', label: 'Restaurantes', emoji: '🍽️' },
    { value: 'farmacia', label: 'Farmacias', emoji: '💊' },
    { value: 'bodega', label: 'Bodegas', emoji: '🛍️' },
    { value: 'colmado', label: 'Colmados', emoji: '🏪' },
    { value: 'supermercado', label: 'Supermercados', emoji: '🛒' },
    { value: 'tienda_ropa', label: 'Moda', emoji: '👗' },
    { value: 'electronica', label: 'Electrónica', emoji: '📱' },
];

@Component({
    selector: 'app-customer-catalog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="min-h-screen bg-gray-50">

      <!-- Header -->
      <header class="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div class="px-4 pt-4 pb-3">
          <h1 class="text-lg font-bold text-gray-900 tracking-tight">Catálogo</h1>
          <p class="text-xs text-gray-400 mt-0.5">Comercios disponibles en tu zona</p>
        </div>

        <!-- Search -->
        <div class="px-4 pb-3">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              [(ngModel)]="searchQuery"
              placeholder="Buscar restaurantes, farmacias..."
              class="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-all border border-transparent" />
          </div>
        </div>

        <!-- Category filter chips -->
        <div class="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          @for (filter of filters; track filter.value) {
            <button
              (click)="selectedFilter.set(filter.value)"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0"
              [class]="selectedFilter() === filter.value
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'">
              {{ filter.emoji }} {{ filter.label }}
            </button>
          }
        </div>
      </header>

      <!-- Results count -->
      @if (!isLoading()) {
        <div class="px-4 py-3 flex items-center justify-between">
          <p class="text-xs text-gray-400 font-medium">
            {{ filtered().length }} {{ filtered().length === 1 ? 'comercio' : 'comercios' }}
          </p>
          @if (openCount() > 0) {
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 text-[10px] font-semibold">
              <span class="w-1.5 h-1.5 rounded-full bg-mint-500 animate-pulse"></span>
              {{ openCount() }} abiertos ahora
            </span>
          }
        </div>
      }

      <!-- Store list -->
      <div class="px-4 pb-6 space-y-3">

        @if (isLoading()) {
          @for (n of [1,2,3,4]; track n) {
            <div class="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
              <div class="h-28 bg-gray-200"></div>
              <div class="p-3 flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0"></div>
                <div class="flex-1 space-y-1.5">
                  <div class="h-3.5 bg-gray-200 rounded w-28"></div>
                  <div class="h-3 bg-gray-200 rounded w-40"></div>
                </div>
              </div>
            </div>
          }
        } @else if (filtered().length === 0) {
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <span class="text-4xl mb-4">🔍</span>
            <h3 class="text-sm font-semibold text-gray-800 mb-1">Sin resultados</h3>
            <p class="text-xs text-gray-400">Intenta con otro filtro o búsqueda</p>
          </div>
        } @else {

          <!-- Featured banner -->
          @if (featuredStore(); as featured) {
            <div class="relative rounded-2xl overflow-hidden h-36 mb-1 shadow-theme-sm">
              @if (featured.banner_url) {
                <img [src]="featured.banner_url" [alt]="featured.name" loading="lazy"
                  class="w-full h-full object-cover" />
              } @else {
                <div class="w-full h-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center">
                  <span class="text-white text-4xl font-bold opacity-20">{{ featured.name[0] }}</span>
                </div>
              }
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <div class="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                <div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-mango-500 text-white text-[10px] font-bold mb-1.5">
                    ⭐ Destacado
                  </span>
                  <p class="text-white font-bold text-base leading-tight">{{ featured.name }}</p>
                  <p class="text-white/70 text-xs mt-0.5">{{ ratingLabel(featured) }}</p>
                </div>
                <button class="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors flex-shrink-0">
                  Ver tienda
                </button>
              </div>
            </div>
          }

          @for (store of filtered(); track store.id) {
            <div class="bg-white rounded-2xl overflow-hidden border shadow-theme-xs transition-all hover:shadow-theme-sm"
              [class]="store.is_open ? 'border-gray-100' : 'border-gray-100 opacity-75'">

              <!-- Banner strip -->
              <div class="relative h-28 bg-gray-50 overflow-hidden">
                @if (store.banner_url) {
                  <img [src]="store.banner_url" [alt]="store.name" loading="lazy"
                    class="w-full h-full object-cover" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center">
                    <span class="text-5xl opacity-10">{{ typeEmoji(store.commerce_type) }}</span>
                  </div>
                }
                @if (!store.is_open) {
                  <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span class="px-3 py-1 rounded-full bg-black/60 text-white text-xs font-semibold">Cerrado</span>
                  </div>
                }
              </div>

              <!-- Content row -->
              <div class="p-3 flex items-center gap-3">

                <!-- Logo -->
                <div class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                  @if (store.logo_url) {
                    <img [src]="store.logo_url" [alt]="store.name" loading="lazy"
                      class="w-full h-full object-cover" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-xl">
                      {{ typeEmoji(store.commerce_type) }}
                    </div>
                  }
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <p class="text-sm font-semibold text-gray-900 truncate">{{ store.name }}</p>
                    @if (store.is_open) {
                      <span class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mint-500"></span>
                    }
                  </div>

                  <!-- Meta: rating · delivery time · min order -->
                  <div class="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    @if (store.avg_rating > 0) {
                      <span class="flex items-center gap-0.5">
                        <span class="text-mango-500">★</span>
                        <span class="font-medium text-gray-600">{{ store.avg_rating | number:'1.1-1' }}</span>
                      </span>
                    }
                    @if (store.avg_delivery_time) {
                      <span>· {{ store.avg_delivery_time }}-{{ store.avg_delivery_time + 10 }} min</span>
                    }
                    @if (store.min_order_amount > 0) {
                      <span>· Mín. RD&#36;{{ fmtPrice(store.min_order_amount) }}</span>
                    }
                  </div>

                  <!-- Free delivery tag -->
                  @if (store.free_delivery_threshold !== null) {
                    <span class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full bg-mint-50 text-mint-700 text-[10px] font-medium">
                      🛵 Gratis al pedir +RD&#36;{{ fmtPrice(store.free_delivery_threshold!) }}
                    </span>
                  }
                </div>

                <!-- Arrow -->
                <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          }

        }
      </div>
    </div>
  `,
})
export class CustomerCatalogPageComponent implements OnInit {
    private readonly supabase = getSupabaseClient();

    readonly isLoading = signal(true);
    readonly commerces = signal<Commerce[]>([]);
    readonly selectedFilter = signal<CommerceFilter>('todos');
    searchQuery = '';

    readonly filters = COMMERCE_FILTERS;

    readonly filtered = computed(() => {
        const type = this.selectedFilter();
        const q = this.searchQuery.toLowerCase().trim();
        return this.commerces().filter(c => {
            const matchType = type === 'todos' || c.commerce_type === type;
            const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
            return matchType && matchSearch;
        });
    });

    readonly openCount = computed(() => this.filtered().filter(c => c.is_open).length);

    readonly featuredStore = computed(() =>
        this.filtered().find(c => c.is_featured && c.is_open) ?? null
    );

    async ngOnInit(): Promise<void> {
        const { data } = await this.supabase
            .from('commerces')
            .select(`
                id, name, slug, description, logo_url, banner_url,
                is_open, avg_rating, total_reviews, avg_delivery_time,
                min_order_amount, commerce_type, delivery_available,
                pickup_available, is_featured, free_delivery_threshold
            `)
            .eq('is_active', true)
            .eq('approval_status', 'aprobado')
            .order('is_featured', { ascending: false })
            .order('avg_rating', { ascending: false });

        this.commerces.set((data ?? []) as Commerce[]);
        this.isLoading.set(false);
    }

    typeEmoji(type: CommerceType): string {
        const map: Record<CommerceType, string> = {
            restaurante: '🍽️',
            farmacia: '💊',
            bodega: '🛍️',
            colmado: '🏪',
            supermercado: '🛒',
            tienda_ropa: '👗',
            electronica: '📱',
            otro: '🏬',
        };
        return map[type] ?? '🏬';
    }

    ratingLabel(store: Commerce): string {
        if (store.avg_rating === 0) return 'Nuevo';
        const stars = store.avg_rating.toFixed(1);
        const reviews = store.total_reviews > 0 ? ` (${store.total_reviews})` : '';
        return `★ ${stars}${reviews}`;
    }

    fmtPrice(n: number): string {
        return Math.round(n).toLocaleString('es-DO');
    }
}
