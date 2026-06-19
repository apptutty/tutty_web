import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Excursion, ExcursionDate, ExcursionsService } from '../../../core/services/excursions.service';

interface DateGroup {
  date: string;
  label: string;
  spotsLeft: number;
  slots: ExcursionDate[];
}

@Component({
  selector: 'app-excursion-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 pb-28">
      @if (service.isLoading() && !service.selectedExcursion()) {
        <div class="animate-pulse">
          <div class="h-[300px] bg-gray-200"></div>
          <div class="mx-5 -mt-8 rounded-[30px] bg-white p-6 shadow-xl">
            <div class="h-4 w-28 rounded-full bg-gray-200"></div>
            <div class="mt-4 h-8 w-3/4 rounded-full bg-gray-200"></div>
            <div class="mt-4 h-4 w-full rounded-full bg-gray-200"></div>
            <div class="mt-2 h-4 w-2/3 rounded-full bg-gray-200"></div>
          </div>
        </div>
      } @else if (service.selectedExcursion(); as excursion) {
        <div class="relative h-[300px] overflow-hidden bg-gray-200">
          <img [src]="currentPhoto()" [alt]="excursion.name" class="h-full w-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/45 to-black/5"></div>

          <button
            type="button"
            class="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg"
            (click)="goBack()"
          >
            ←
          </button>

          <div class="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800 shadow-lg">
            {{ currentPhotoIndex() + 1 }} / {{ photoCount() }}
          </div>

          @if (photoCount() > 1) {
            <button
              type="button"
              class="absolute bottom-5 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg text-gray-800 shadow-lg"
              (click)="prevPhoto()"
            >
              ‹
            </button>
            <button
              type="button"
              class="absolute bottom-5 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg text-gray-800 shadow-lg"
              (click)="nextPhoto()"
            >
              ›
            </button>
          }
        </div>

        <section class="relative z-10 mx-auto -mt-8 max-w-4xl px-5">
          <div class="rounded-[32px] bg-white p-6 shadow-xl">
            <div class="flex flex-wrap items-center gap-3">
              <span class="rounded-full bg-purple-500 px-3 py-1 text-xs font-semibold text-white">{{ excursion.operator_name }}</span>
              @if (excursion.operator_category) {
                <span class="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">{{ excursion.operator_category }}</span>
              }
            </div>

            <div class="mt-4 space-y-3">
              <h1 class="text-2xl font-bold text-gray-900">{{ excursion.name }}</h1>
              <div class="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                @if (excursion.avg_rating > 0) {
                  <div class="flex items-center gap-1.5">
                    @for (star of stars; track trackNumber($index, star)) {
                      <span [class]="star <= filledStars() ? 'text-mango-500' : 'text-gray-200'">★</span>
                    }
                    <span class="font-semibold text-gray-800">{{ excursion.avg_rating | number:'1.1-1' }}</span>
                    <span>({{ excursion.total_reviews }} reseñas)</span>
                  </div>
                }
                <div class="text-lg font-bold text-brand-500">
                  &#36;{{ excursion.price_per_person | number:'1.0-0' }}
                  <span class="text-sm font-medium text-gray-400">/ persona</span>
                </div>
              </div>
              @if (excursion.description || excursion.short_description) {
                <p class="text-sm leading-6 text-gray-600">{{ excursion.description || excursion.short_description }}</p>
              }
            </div>

            <div class="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-2">
              @for (chip of infoChips(); track trackChip($index, chip)) {
                <div class="whitespace-nowrap rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                  {{ chip }}
                </div>
              }
            </div>

            <div class="mt-6 space-y-3">
              @if (excursion.what_is_included.length > 0) {
                <section class="overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
                  <button type="button" class="flex w-full items-center justify-between px-5 py-4 text-left" (click)="toggleSection('includes')">
                    <span class="font-semibold text-gray-900">Qué incluye ✅</span>
                    <span class="text-xl text-gray-400">{{ openSection() === 'includes' ? '−' : '+' }}</span>
                  </button>
                  @if (openSection() === 'includes') {
                    <div class="space-y-2 px-5 pb-5 text-sm text-gray-600">
                      @for (item of excursion.what_is_included; track trackText($index, item)) {
                        <p>• {{ item }}</p>
                      }
                    </div>
                  }
                </section>
              }

              @if (excursion.what_to_bring.length > 0) {
                <section class="overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
                  <button type="button" class="flex w-full items-center justify-between px-5 py-4 text-left" (click)="toggleSection('bring')">
                    <span class="font-semibold text-gray-900">Qué llevar 🎒</span>
                    <span class="text-xl text-gray-400">{{ openSection() === 'bring' ? '−' : '+' }}</span>
                  </button>
                  @if (openSection() === 'bring') {
                    <div class="space-y-2 px-5 pb-5 text-sm text-gray-600">
                      @for (item of excursion.what_to_bring; track trackText($index, item)) {
                        <p>• {{ item }}</p>
                      }
                    </div>
                  }
                </section>
              }

              @if (excursion.what_is_not_included.length > 0) {
                <section class="overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
                  <button type="button" class="flex w-full items-center justify-between px-5 py-4 text-left" (click)="toggleSection('not-included')">
                    <span class="font-semibold text-gray-900">No incluye ❌</span>
                    <span class="text-xl text-gray-400">{{ openSection() === 'not-included' ? '−' : '+' }}</span>
                  </button>
                  @if (openSection() === 'not-included') {
                    <div class="space-y-2 px-5 pb-5 text-sm text-gray-600">
                      @for (item of excursion.what_is_not_included; track trackText($index, item)) {
                        <p>• {{ item }}</p>
                      }
                    </div>
                  }
                </section>
              }

              @if (excursion.meeting_point) {
                <section class="overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
                  <button type="button" class="flex w-full items-center justify-between px-5 py-4 text-left" (click)="toggleSection('meeting-point')">
                    <span class="font-semibold text-gray-900">Punto de encuentro 📍</span>
                    <span class="text-xl text-gray-400">{{ openSection() === 'meeting-point' ? '−' : '+' }}</span>
                  </button>
                  @if (openSection() === 'meeting-point') {
                    <div class="px-5 pb-5 text-sm leading-6 text-gray-600">{{ excursion.meeting_point }}</div>
                  }
                </section>
              }

              @if (hasRequirements(excursion)) {
                <section class="overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
                  <button type="button" class="flex w-full items-center justify-between px-5 py-4 text-left" (click)="toggleSection('requirements')">
                    <span class="font-semibold text-gray-900">Requisitos ⚠️</span>
                    <span class="text-xl text-gray-400">{{ openSection() === 'requirements' ? '−' : '+' }}</span>
                  </button>
                  @if (openSection() === 'requirements') {
                    <div class="space-y-2 px-5 pb-5 text-sm leading-6 text-gray-600">
                      @if (excursion.min_age !== null || excursion.max_age !== null) {
                        <p>Edad: {{ ageLabel(excursion) }}</p>
                      }
                      @if (excursion.physical_requirements) {
                        <p>{{ excursion.physical_requirements }}</p>
                      }
                      @if (excursion.health_warnings) {
                        <p>{{ excursion.health_warnings }}</p>
                      }
                    </div>
                  }
                </section>
              }
            </div>

            <div class="mt-8 rounded-[28px] bg-gray-50 p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-lg font-bold text-gray-900">Fechas disponibles</h2>
                  <p class="text-sm text-gray-500">Elige la mejor opción para tu aventura</p>
                </div>
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm">{{ service.availableDates().length }} salidas</span>
              </div>

              @if (dateGroups().length > 0) {
                <div class="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-2">
                  @for (group of dateGroups(); track trackDateGroup($index, group)) {
                    <button
                      type="button"
                      class="min-w-[104px] rounded-2xl border px-4 py-3 text-left transition-all"
                      [class]="selectedDay() === group.date
                        ? 'border-purple-500 bg-purple-500 text-white'
                        : group.spotsLeft <= 0
                          ? 'border-gray-200 bg-gray-100 text-gray-400 opacity-50'
                          : 'border-gray-200 bg-white text-gray-700'"
                      [disabled]="group.spotsLeft <= 0"
                      (click)="selectDay(group.date)"
                    >
                      <div class="text-sm font-semibold">{{ group.label.split(' / ')[0] }}</div>
                      <div class="text-lg font-bold">{{ group.label.split(' / ')[1] }}</div>
                      <div class="text-xs">{{ group.label.split(' / ')[2] }}</div>
                    </button>
                  }
                </div>

                @if (timeSlots().length > 0) {
                  <div class="mt-4 flex flex-wrap gap-3">
                    @for (slot of timeSlots(); track trackSlot($index, slot)) {
                      <button
                        type="button"
                        class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                        [class]="service.selectedDate()?.id === slot.id
                          ? 'border-purple-500 bg-purple-500 text-white'
                          : 'border-gray-200 bg-white text-gray-700'"
                        (click)="selectTime(slot)"
                      >
                        {{ formatTime(slot.departure_time) }}
                      </button>
                    }
                  </div>
                }
              } @else {
                <div class="mt-4 rounded-2xl bg-white px-4 py-5 text-sm text-gray-500">Pronto publicaremos nuevas fechas para esta experiencia.</div>
              }
            </div>
          </div>
        </section>

        <div class="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div class="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-wide text-gray-400">Desde</p>
              <p class="text-xl font-bold text-brand-500">&#36;{{ excursion.price_per_person | number:'1.0-0' }}</p>
            </div>
            <a
              [routerLink]="['/customer/excursions', excursion.id, 'book']"
              class="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-600"
            >
              Reservar
            </a>
          </div>
        </div>
      } @else {
        <div class="px-5 py-20 text-center text-gray-500">No encontramos esta excursión.</div>
      }
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
export class ExcursionDetailPageComponent implements OnInit {
  protected readonly service = inject(ExcursionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly currentPhotoIndex = signal(0);
  protected readonly openSection = signal<string | null>(null);
  protected readonly selectedDay = signal<string | null>(null);
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly photoCount = computed(() => Math.max(this.photos().length, 1));
  protected readonly currentPhoto = computed(() => this.photos()[this.currentPhotoIndex()] ?? this.fallbackPhoto);
  protected readonly filledStars = computed(() => Math.round(this.service.selectedExcursion()?.avg_rating ?? 0));
  protected readonly dateGroups = computed<DateGroup[]>(() => {
    const groups = new Map<string, DateGroup>();
    for (const slot of this.service.availableDates()) {
      const existing = groups.get(slot.date);
      if (existing) {
        existing.slots.push(slot);
        existing.spotsLeft += slot.spots_left;
      } else {
        groups.set(slot.date, {
          date: slot.date,
          label: this.formatDate(slot.date),
          spotsLeft: slot.spots_left,
          slots: [slot],
        });
      }
    }
    return Array.from(groups.values());
  });
  protected readonly timeSlots = computed(() => {
    const selectedDay = this.selectedDay();
    if (!selectedDay) {
      return [];
    }
    return this.service.availableDates().filter(slot => slot.date === selectedDay);
  });

  private readonly fallbackPhoto = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200';

  async ngOnInit(): Promise<void> {
    const excursionId = this.route.snapshot.paramMap.get('id');
    if (!excursionId) {
      return;
    }

    await this.service.loadExcursionDetail(excursionId);
    this.currentPhotoIndex.set(0);
    const firstDate = this.dateGroups()[0]?.date ?? null;
    this.selectedDay.set(this.service.selectedDate()?.date ?? firstDate);
    if (!this.service.selectedDate() && this.timeSlots()[0]) {
      this.service.selectedDate.set(this.timeSlots()[0]);
    }
  }

  protected prevPhoto(): void {
    const total = this.photoCount();
    this.currentPhotoIndex.set((this.currentPhotoIndex() - 1 + total) % total);
  }

  protected nextPhoto(): void {
    const total = this.photoCount();
    this.currentPhotoIndex.set((this.currentPhotoIndex() + 1) % total);
  }

  protected toggleSection(section: string): void {
    this.openSection.set(this.openSection() === section ? null : section);
  }

  protected selectDay(day: string): void {
    this.selectedDay.set(day);
    const firstSlot = this.service.availableDates().find(slot => slot.date === day) ?? null;
    this.service.selectedDate.set(firstSlot);
  }

  protected selectTime(slot: ExcursionDate): void {
    this.service.selectedDate.set(slot);
  }

  protected goBack(): void {
    void this.router.navigate(['/customer/excursions']);
  }

  protected hasRequirements(excursion: Excursion): boolean {
    return !!excursion.physical_requirements || !!excursion.health_warnings || excursion.min_age !== null || excursion.max_age !== null;
  }

  protected ageLabel(excursion: Excursion): string {
    if (excursion.min_age !== null && excursion.max_age !== null) {
      return `${excursion.min_age} - ${excursion.max_age} años`;
    }
    if (excursion.min_age !== null) {
      return `Desde ${excursion.min_age} años`;
    }
    return `Hasta ${excursion.max_age} años`;
  }

  protected formatTime(value: string): string {
    return value.slice(0, 5);
  }

  protected trackNumber(_: number, value: number): number {
    return value;
  }

  protected trackChip(_: number, value: string): string {
    return value;
  }

  protected trackText(_: number, value: string): string {
    return value;
  }

  protected trackDateGroup(_: number, group: DateGroup): string {
    return group.date;
  }

  protected trackSlot(_: number, slot: ExcursionDate): string {
    return slot.id;
  }

  private photos(): string[] {
    return this.service.selectedExcursion()?.photos?.length
      ? this.service.selectedExcursion()!.photos
      : [this.fallbackPhoto];
  }

  protected infoChips(): string[] {
    const excursion = this.service.selectedExcursion();
    if (!excursion) {
      return [];
    }

    const chips = [
      excursion.duration_hours ? `⏱️ ${excursion.duration_hours} horas` : null,
      `👥 ${excursion.min_people}${excursion.max_people ? ` - ${excursion.max_people}` : '+'} personas`,
      `🌍 ${excursion.language}`,
      excursion.wheelchair_accessible ? '♿ Accesible' : null,
    ];

    return chips.filter((chip): chip is string => !!chip);
  }

  private formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    const [weekday = '', day = '', month = ''] = date
      .toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace('.', '')
      .split(' ')
      .filter(Boolean);
    return `${this.capitalize(weekday)} / ${day} / ${this.capitalize(month)}`;
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
