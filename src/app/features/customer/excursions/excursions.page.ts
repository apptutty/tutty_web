import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';

type DifficultyLevel = 'facil' | 'moderado' | 'dificil';
type CategoryFilter = 'todos' | 'playa' | 'montana' | 'ciudad' | 'aventura' | 'cultural';

interface Excursion {
    id: string;
    name: string;
    short_description: string | null;
    photos: string[];
    price_per_person: number;
    duration_hours: number | null;
    difficulty_level: DifficultyLevel | null;
    hotel_pickup: boolean;
    what_is_included: string[];
    avg_rating: number;
    total_reviews: number;
    category: string | null;
    min_people: number;
}

const DIFFICULTY_CFG: Record<DifficultyLevel, { label: string; color: string }> = {
    facil: { label: 'Fácil', color: 'bg-mint-50 text-mint-700' },
    moderado: { label: 'Moderado', color: 'bg-mango-50 text-yellow-700' },
    dificil: { label: 'Difícil', color: 'bg-coral-50 text-coral-700' },
};

const CATEGORY_FILTERS: { value: CategoryFilter; label: string; emoji: string }[] = [
    { value: 'todos', label: 'Todos', emoji: '🌟' },
    { value: 'playa', label: 'Playa', emoji: '🏖️' },
    { value: 'montana', label: 'Montaña', emoji: '🏔️' },
    { value: 'aventura', label: 'Aventura', emoji: '🧗' },
    { value: 'cultural', label: 'Cultural', emoji: '🏛️' },
    { value: 'ciudad', label: 'Ciudad', emoji: '🏙️' },
];

@Component({
    selector: 'app-customer-excursions',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="min-h-screen bg-gray-50">

      <!-- Header -->
      <header class="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div class="px-4 pt-4 pb-3">
          <h1 class="text-lg font-bold text-gray-900 tracking-tight">Excursiones</h1>
          <p class="text-xs text-gray-400 mt-0.5">Descubre lo mejor de República Dominicana</p>
        </div>

        <!-- Category filter chips (horizontal scroll) -->
        <div class="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          @for (cat of categories; track cat.value) {
            <button
              (click)="selectedCategory.set(cat.value)"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0"
              [class]="selectedCategory() === cat.value
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'">
              {{ cat.emoji }} {{ cat.label }}
            </button>
          }
        </div>
      </header>

      <!-- Count -->
      @if (!isLoading()) {
        <div class="px-4 py-3">
          <p class="text-xs text-gray-400 font-medium">
            {{ filtered().length }} {{ filtered().length === 1 ? 'experiencia' : 'experiencias' }} disponibles
          </p>
        </div>
      }

      <!-- Grid -->
      <div class="px-4 pb-6 space-y-4">

        @if (isLoading()) {
          @for (n of [1,2,3]; track n) {
            <div class="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
              <div class="h-44 bg-gray-200"></div>
              <div class="p-4 space-y-2">
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                <div class="h-3 bg-gray-200 rounded w-full"></div>
                <div class="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          }
        } @else if (filtered().length === 0) {
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <span class="text-4xl mb-4">🗺️</span>
            <h3 class="text-sm font-semibold text-gray-800 mb-1">Sin excursiones disponibles</h3>
            <p class="text-xs text-gray-400">Prueba otro filtro o vuelve más tarde</p>
          </div>
        } @else {
          @for (exc of filtered(); track exc.id) {
            <div class="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-theme-xs">

              <!-- Photo -->
              <div class="relative h-44 bg-gray-100 overflow-hidden">
                @if (exc.photos.length > 0) {
                  <img [src]="exc.photos[0]" [alt]="exc.name"
                    loading="lazy"
                    class="w-full h-full object-cover" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-brand-50">
                    <span class="text-4xl">🌴</span>
                  </div>
                }

                <!-- Difficulty badge -->
                @if (exc.difficulty_level) {
                  <span class="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-semibold"
                    [class]="diffCfg(exc.difficulty_level).color">
                    {{ diffCfg(exc.difficulty_level).label }}
                  </span>
                }

                <!-- Hotel pickup badge -->
                @if (exc.hotel_pickup) {
                  <span class="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-semibold bg-ocean-50 text-ocean-700">
                    🏨 Recogida
                  </span>
                }
              </div>

              <!-- Body -->
              <div class="p-4">
                <div class="flex items-start justify-between gap-2 mb-1.5">
                  <h3 class="text-sm font-bold text-gray-900 leading-tight flex-1">{{ exc.name }}</h3>
                  <!-- Rating -->
                  @if (exc.avg_rating > 0) {
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <span class="text-mango-500 text-xs">★</span>
                      <span class="text-xs font-semibold text-gray-700">{{ exc.avg_rating | number:'1.1-1' }}</span>
                      @if (exc.total_reviews > 0) {
                        <span class="text-xs text-gray-400">({{ exc.total_reviews }})</span>
                      }
                    </div>
                  }
                </div>

                @if (exc.short_description) {
                  <p class="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">{{ exc.short_description }}</p>
                }

                <!-- Meta row -->
                <div class="flex items-center gap-3 text-xs text-gray-400 mb-3">
                  @if (exc.duration_hours) {
                    <span class="flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {{ exc.duration_hours }}h
                    </span>
                  }
                  <span class="flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    Mín. {{ exc.min_people }}
                  </span>
                </div>

                <!-- Includes chips -->
                @if (exc.what_is_included.length > 0) {
                  <div class="flex gap-1.5 flex-wrap mb-3">
                    @for (item of exc.what_is_included.slice(0, 3); track item) {
                      <span class="px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 text-[10px] font-medium">
                        ✓ {{ item }}
                      </span>
                    }
                    @if (exc.what_is_included.length > 3) {
                      <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px]">
                        +{{ exc.what_is_included.length - 3 }}
                      </span>
                    }
                  </div>
                }

                <!-- Price + CTA -->
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-xs text-gray-400">Desde</span>
                    <p class="text-base font-bold text-gray-900">
                      RD$ {{ fmtPrice(exc.price_per_person) }}
                      <span class="text-xs font-normal text-gray-400">/ persona</span>
                    </p>
                  </div>
                  <button
                    class="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors">
                    Reservar
                  </button>
                </div>
              </div>
            </div>
          }
        }

      </div>
    </div>
  `,
})
export class CustomerExcursionsPageComponent implements OnInit {
    private readonly supabase = getSupabaseClient();

    readonly isLoading = signal(true);
    readonly excursions = signal<Excursion[]>([]);
    readonly selectedCategory = signal<CategoryFilter>('todos');

    readonly categories = CATEGORY_FILTERS;

    readonly filtered = computed(() => {
        const cat = this.selectedCategory();
        const all = this.excursions();
        if (cat === 'todos') return all;
        return all.filter(e => e.category === cat);
    });

    async ngOnInit(): Promise<void> {
        const { data } = await this.supabase
            .from('excursions')
            .select(`
                id, name, short_description, photos, price_per_person,
                duration_hours, difficulty_level, hotel_pickup,
                what_is_included, min_people,
                excursion_operators (avg_rating, total_reviews, category)
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (data) {
            this.excursions.set(data.map((e: any) => ({
                ...e,
                avg_rating: e.excursion_operators?.avg_rating ?? 0,
                total_reviews: e.excursion_operators?.total_reviews ?? 0,
                category: e.excursion_operators?.category ?? null,
            })));
        }
        this.isLoading.set(false);
    }

    diffCfg(level: DifficultyLevel) {
        return DIFFICULTY_CFG[level] ?? { label: level, color: 'bg-gray-100 text-gray-600' };
    }

    fmtPrice(n: number): string {
        return Math.round(n).toLocaleString('es-DO');
    }
}
