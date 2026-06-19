import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Excursion, ExcursionsService } from '../../core/services/excursions.service';

interface CategoryChip {
  value: string;
  label: string;
}

@Component({
  selector: 'app-excursions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 pb-8">
      <section class="relative h-[280px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"
          alt="Excursiones en República Dominicana"
          class="h-full w-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-br from-purple-900/70 to-purple-900/85"></div>
        <div class="absolute inset-0 px-5 pb-8 pt-10 text-white">
          <div class="mx-auto flex h-full max-w-6xl flex-col justify-end">
            <div class="max-w-xl space-y-2">
              <p class="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">Tuttys Experiences</p>
              <h1 class="text-3xl font-bold leading-tight">¿Dónde quieres explorar?</h1>
              <p class="text-sm text-white/85">Descubre lo mejor de República Dominicana</p>
            </div>

            <label class="mt-6 flex items-center gap-3 rounded-full bg-white px-4 py-3 text-gray-500 shadow-xl">
              <svg class="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <input
                type="search"
                class="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                placeholder="Busca playa, aventura o tu lugar favorito"
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event ?? '')"
              />
            </label>
          </div>
        </div>
      </section>

      <div class="relative z-10 mx-auto -mt-6 max-w-6xl px-5">
        <div class="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          @for (category of categories; track trackCategory($index, category)) {
            <button
              type="button"
              class="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-all"
              [class]="service.activeCategory() === category.value
                ? 'bg-purple-500 text-white'
                : 'border border-gray-200 bg-white text-gray-600'"
              (click)="setCategory(category.value)"
            >
              {{ category.label }}
            </button>
          }
        </div>
      </div>

      <section class="mx-auto mt-6 max-w-6xl px-5">
        <div class="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-gray-900">Top experiencias</h2>
            <p class="text-sm text-gray-500">Las favoritas para tu próxima aventura</p>
          </div>
          <button type="button" class="text-sm font-semibold text-brand-500" (click)="resetFilters()">Ver todo</button>
        </div>

        @if (service.isLoading()) {
          <div class="space-y-4">
            @for (skeleton of skeletons; track trackNumber($index, skeleton)) {
              <div class="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm animate-pulse">
                <div class="h-[220px] bg-gray-200"></div>
                <div class="space-y-3 p-5">
                  <div class="h-4 w-32 rounded-full bg-gray-200"></div>
                  <div class="h-6 w-3/4 rounded-full bg-gray-200"></div>
                  <div class="h-4 w-full rounded-full bg-gray-200"></div>
                </div>
              </div>
            }
          </div>
        } @else if (!featuredExcursion()) {
          <div class="rounded-[28px] bg-white px-6 py-16 text-center shadow-sm">
            <div class="text-5xl">🏝️</div>
            <h3 class="mt-4 text-xl font-bold text-gray-900">No hay excursiones disponibles</h3>
            <p class="mt-2 text-sm text-gray-500">Vuelve pronto</p>
          </div>
        } @else {
          <article class="relative overflow-hidden rounded-[32px] shadow-xl">
            <img
              [src]="coverPhoto(featuredExcursion()!)"
              [alt]="featuredExcursion()!.name"
              class="h-[220px] w-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-purple-950 via-purple-950/45 to-transparent"></div>
            <div class="absolute inset-0 flex flex-col justify-between p-5 text-white">
              <div class="flex items-start justify-between gap-3">
                <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{{ featuredExcursion()!.operator_name }}</span>
                @if (isLastSpots(featuredExcursion()!.id)) {
                  <span class="rounded-full bg-coral-500 px-3 py-1 text-xs font-semibold text-white">¡Últimos lugares!</span>
                }
              </div>

              <div class="space-y-3">
                <div class="flex flex-wrap items-center gap-3 text-xs text-white/80">
                  <span class="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{{ featuredExcursion()!.operator_category || 'Experiencia destacada' }}</span>
                  @if (featuredExcursion()!.avg_rating > 0) {
                    <span class="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                      <span class="text-mango-500">★</span>
                      {{ featuredExcursion()!.avg_rating | number:'1.1-1' }}
                    </span>
                  }
                </div>
                <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div class="space-y-2">
                    <h3 class="text-2xl font-bold leading-tight">{{ featuredExcursion()!.name }}</h3>
                    <p class="max-w-2xl text-sm text-white/80">{{ featuredExcursion()!.short_description || 'Una escapada memorable con paisajes, cultura y momentos inolvidables.' }}</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-500">
                      &#36;{{ featuredExcursion()!.price_per_person | number:'1.0-0' }}
                    </span>
                    <a
                      [routerLink]="['/customer/excursions', featuredExcursion()!.id]"
                      class="rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-600"
                    >
                      Ver experiencia
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </article>

          @if (remainingExcursions().length > 0) {
            <div class="mt-6">
              <div class="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                @for (excursion of remainingExcursions(); track trackExcursion($index, excursion)) {
                  <a
                    [routerLink]="['/customer/excursions', excursion.id]"
                    class="w-[180px] flex-shrink-0 overflow-hidden rounded-[26px] bg-white shadow-sm transition hover:-translate-y-1"
                  >
                    <div class="relative h-44 overflow-hidden">
                      <img [src]="coverPhoto(excursion)" [alt]="excursion.name" class="h-full w-full object-cover" />
                      @if (isLastSpots(excursion.id)) {
                        <span class="absolute left-3 top-3 rounded-full bg-coral-500 px-2.5 py-1 text-[11px] font-semibold text-white">¡Últimos!</span>
                      }
                    </div>
                    <div class="space-y-2 p-4">
                      <p class="text-xs font-semibold uppercase tracking-wide text-purple-500">{{ excursion.operator_name }}</p>
                      <h3 class="line-clamp-2 text-sm font-bold text-gray-900">{{ excursion.name }}</h3>
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-bold text-brand-500">&#36;{{ excursion.price_per_person | number:'1.0-0' }}</span>
                        @if (excursion.avg_rating > 0) {
                          <span class="flex items-center gap-1 text-xs text-gray-500"><span class="text-mango-500">★</span>{{ excursion.avg_rating | number:'1.1-1' }}</span>
                        }
                      </div>
                    </div>
                  </a>
                }
              </div>
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }

    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `],
})
export class ExcursionsPageComponent implements OnInit {
  protected readonly service = inject(ExcursionsService);
  protected readonly searchTerm = signal('');
  protected readonly categories: CategoryChip[] = [
    { value: 'todos', label: 'Todos 🌴' },
    { value: 'aventura', label: 'Aventura 🧗' },
    { value: 'playa', label: 'Playa 🏖️' },
    { value: 'cultural', label: 'Cultural 🏛️' },
    { value: 'naturaleza', label: 'Naturaleza 🌿' },
    { value: 'gastronomia', label: 'Gastronomía 🍽️' },
  ];
  protected readonly skeletons = [1, 2, 3];
  protected readonly filteredResults = computed(() => {
    const query = this.normalize(this.searchTerm());
    return this.service.filteredExcursions().filter(excursion => {
      if (!query) {
        return true;
      }
      const haystack = [
        excursion.name,
        excursion.short_description ?? '',
        excursion.operator_name,
        excursion.operator_category ?? '',
      ].join(' ');
      return this.normalize(haystack).includes(query);
    });
  });
  protected readonly featuredExcursion = computed(() => this.filteredResults()[0] ?? null);
  protected readonly remainingExcursions = computed(() => this.filteredResults().slice(1));

  async ngOnInit(): Promise<void> {
    await this.service.loadExcursions();
  }

  protected setCategory(category: string): void {
    this.service.activeCategory.set(category);
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.service.activeCategory.set('todos');
  }

  protected coverPhoto(excursion: Excursion): string {
    return excursion.photos[0] || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
  }

  protected isLastSpots(excursionId: string): boolean {
    const spotsLeft = this.service.spotsLeftFor(excursionId);
    return spotsLeft !== null && spotsLeft < 5;
  }

  protected trackCategory(_: number, category: CategoryChip): string {
    return category.value;
  }

  protected trackExcursion(_: number, excursion: Excursion): string {
    return excursion.id;
  }

  protected trackNumber(_: number, value: number): number {
    return value;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
