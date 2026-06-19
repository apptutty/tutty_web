import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ExcursionDate, ExcursionsService } from '../../../core/services/excursions.service';

interface ParticipantForm {
  full_name: string;
  id_number: string;
  phone: string;
}

interface DateGroup {
  date: string;
  label: string;
  spotsLeft: number;
}

@Component({
  selector: 'app-excursion-booking-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 px-5 py-6">
      <div class="mx-auto max-w-4xl space-y-6">
        <button type="button" class="text-sm font-semibold text-purple-700" (click)="goBack()">← Volver</button>

        @if (service.selectedExcursion(); as excursion) {
          <header class="rounded-[32px] bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.2em] text-purple-500">Reserva tu experiencia</p>
                <h1 class="mt-2 text-2xl font-bold text-gray-900">{{ excursion.name }}</h1>
                <p class="mt-1 text-sm text-gray-500">{{ excursion.operator_name }} · {{ excursion.language }}</p>
              </div>
              <div class="rounded-3xl bg-brand-50 px-4 py-3 text-right">
                <p class="text-xs uppercase tracking-wide text-brand-500">Precio por persona</p>
                <p class="text-2xl font-bold text-brand-500">&#36;{{ excursion.price_per_person | number:'1.0-0' }}</p>
              </div>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start">
              @for (step of steps(); track trackStep($index, step)) {
                <div class="flex flex-col items-center gap-2 text-center">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition"
                    [class]="step.status === 'current'
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : step.status === 'done'
                        ? 'border-mint-500 bg-mint-500 text-white'
                        : 'border-gray-200 bg-white text-gray-400'"
                  >
                    {{ step.status === 'done' ? '✓' : step.index }}
                  </div>
                  <span class="text-xs font-semibold text-gray-500">{{ step.label }}</span>
                </div>
                @if (!$last) {
                  <div class="hidden h-0.5 self-center bg-gray-200 md:block" [class.bg-mint-500]="steps()[$index + 1].status !== 'pending'"></div>
                }
              }
            </div>
          </header>

          @if (service.isLoading() && !service.availableDates().length) {
            <div class="rounded-[32px] bg-white p-6 shadow-sm animate-pulse">
              <div class="h-6 w-40 rounded-full bg-gray-200"></div>
              <div class="mt-4 h-24 rounded-3xl bg-gray-100"></div>
            </div>
          } @else if (bookingSuccess()) {
            <section class="rounded-[32px] bg-white p-8 text-center shadow-sm">
              <div class="success-pop mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-mint-500/15 text-5xl text-mint-500">✅</div>
              <h2 class="mt-6 text-3xl font-bold text-gray-900">¡Reserva confirmada! 🎉</h2>
              <p class="mt-2 text-sm text-gray-500">Tu número de reserva es</p>
              <p class="mt-2 text-2xl font-bold text-purple-700">{{ bookingNumber() }}</p>
              <div class="mt-6 rounded-[28px] bg-gray-50 p-5 text-left">
                <p class="font-semibold text-gray-900">{{ excursion.name }}</p>
                <p class="mt-2 text-sm text-gray-500">{{ successDateLabel() }}</p>
                <p class="mt-2 text-lg font-bold text-brand-500">Total pagado: &#36;{{ service.totalPrice() | number:'1.0-0' }}</p>
              </div>
              <div class="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" class="flex-1 rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700" (click)="shareBooking()">Compartir</button>
                <button type="button" class="flex-1 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white" (click)="goToCatalog()">Volver al catálogo</button>
              </div>
            </section>
          } @else if (currentStep() === 1) {
            <section class="rounded-[32px] bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-xl font-bold text-gray-900">Fecha y hora</h2>
                  <p class="text-sm text-gray-500">Selecciona la salida ideal para ti</p>
                </div>
                <span class="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">{{ service.availableDates().length }} salidas</span>
              </div>

              <div class="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-2">
                @for (group of dateGroups(); track trackDateGroup($index, group)) {
                  <button
                    type="button"
                    class="min-w-[104px] rounded-2xl border px-4 py-3 text-left transition-all"
                    [class]="selectedDay() === group.date
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-gray-200 bg-white text-gray-700'"
                    (click)="selectDay(group.date)"
                  >
                    <div class="text-sm font-semibold">{{ group.label.split(' / ')[0] }}</div>
                    <div class="text-lg font-bold">{{ group.label.split(' / ')[1] }}</div>
                    <div class="text-xs">{{ group.label.split(' / ')[2] }}</div>
                  </button>
                }
              </div>

              @if (timeSlots().length > 0) {
                <div class="mt-5 flex flex-wrap gap-3">
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

              <div class="mt-8 rounded-[28px] bg-gray-50 p-5">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-base font-bold text-gray-900">Participantes</h3>
                    <p class="text-sm text-gray-500">Ajusta según tu grupo</p>
                  </div>
                  <div class="flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow-sm">
                    <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-700" (click)="decrementPeople()">−</button>
                    <span class="min-w-8 text-center text-lg font-bold text-gray-900">{{ service.numPeople() }}</span>
                    <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-700" (click)="incrementPeople()">+</button>
                  </div>
                </div>
                <p class="mt-4 text-sm text-gray-500">Permitido: {{ minPeople() }} - {{ maxPeople() }} personas</p>
                <p class="mt-4 text-lg font-bold text-brand-500">Total: RD&#36; {{ service.totalPrice() | number:'1.0-0' }}</p>
              </div>

              @if (excursion.hotel_pickup) {
                <div class="mt-6 rounded-[28px] border border-pink-100 bg-pink-50 p-5">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <h3 class="text-base font-bold text-gray-900">Recogida en hotel</h3>
                      <p class="text-sm text-gray-500">Actívala si deseas coordinar tu punto de recogida</p>
                    </div>
                    <button
                      type="button"
                      class="relative h-8 w-14 rounded-full transition"
                      [class]="hotelPickupEnabled() ? 'bg-brand-500' : 'bg-gray-300'"
                      (click)="hotelPickupEnabled.set(!hotelPickupEnabled())"
                    >
                      <span class="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition" [class.left-1]="!hotelPickupEnabled()" [class.left-7]="hotelPickupEnabled()"></span>
                    </button>
                  </div>
                  @if (hotelPickupEnabled()) {
                    <input
                      type="text"
                      class="mt-4 w-full rounded-2xl border border-white bg-white px-4 py-3 text-sm outline-none ring-0"
                      placeholder="Nombre del hotel"
                      [ngModel]="hotelName()"
                      (ngModelChange)="hotelName.set($event ?? '')"
                    />
                  }
                </div>
              }

              <div class="mt-8 flex justify-end">
                <button
                  type="button"
                  class="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  [disabled]="!service.selectedDate()"
                  (click)="goToStep(2)"
                >
                  Siguiente
                </button>
              </div>
            </section>
          } @else if (currentStep() === 2) {
            <section class="rounded-[32px] bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h2 class="text-xl font-bold text-gray-900">Participantes</h2>
                  <p class="text-sm text-gray-500">Completa los datos de cada viajero</p>
                </div>
                <span class="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">{{ participantSlots().length }} personas</span>
              </div>

              <div class="mt-6 space-y-4">
                @for (index of participantSlots(); track trackNumber($index, index)) {
                  <article class="rounded-[28px] border border-gray-100 bg-gray-50 p-5">
                    <div class="mb-4 flex items-center justify-between gap-3">
                      <span class="rounded-full bg-purple-500 px-3 py-1 text-xs font-semibold text-white">Participante #{{ index + 1 }}</span>
                      @if (index === 0) {
                        <button type="button" class="text-sm font-semibold text-brand-500" (click)="useMyData()">Usar mis datos</button>
                      }
                    </div>
                    <div class="grid gap-4 md:grid-cols-3">
                      <input
                        type="text"
                        class="rounded-2xl border border-white bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Nombre completo *"
                        [ngModel]="participants()[index]?.full_name"
                        (ngModelChange)="updateParticipant(index, 'full_name', $event ?? '')"
                      />
                      <input
                        type="text"
                        class="rounded-2xl border border-white bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Cédula o ID"
                        [ngModel]="participants()[index]?.id_number"
                        (ngModelChange)="updateParticipant(index, 'id_number', $event ?? '')"
                      />
                      <input
                        type="tel"
                        class="rounded-2xl border border-white bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Teléfono"
                        [ngModel]="participants()[index]?.phone"
                        (ngModelChange)="updateParticipant(index, 'phone', $event ?? '')"
                      />
                    </div>
                  </article>
                }
              </div>

              <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" class="rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700" (click)="goToStep(1)">Atrás</button>
                <button
                  type="button"
                  class="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  [disabled]="!participantsReady()"
                  (click)="goToStep(3)"
                >
                  Siguiente
                </button>
              </div>
            </section>
          } @else {
            <section class="rounded-[32px] bg-white p-6 shadow-sm">
              <h2 class="text-xl font-bold text-gray-900">Confirmar reserva</h2>
              <p class="mt-1 text-sm text-gray-500">Revisa los datos antes de confirmar</p>

              <div class="mt-6 rounded-[28px] bg-gray-50 p-5">
                <p class="text-lg font-bold text-gray-900">{{ excursion.name }}</p>
                <div class="mt-3 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                  <p><span class="font-semibold text-gray-800">Fecha:</span> {{ selectedDateLabel() }}</p>
                  <p><span class="font-semibold text-gray-800">Hora:</span> {{ formatTime(service.selectedDate()?.departure_time || '') }}</p>
                  <p><span class="font-semibold text-gray-800">Participantes:</span> {{ service.numPeople() }}</p>
                  <p><span class="font-semibold text-gray-800">Total:</span> <span class="font-bold text-brand-500">RD&#36; {{ service.totalPrice() | number:'1.0-0' }}</span></p>
                </div>
              </div>

              <div class="mt-6">
                <p class="text-sm font-semibold text-gray-700">Método de pago</p>
                <div class="mt-3 flex flex-wrap gap-3">
                  @for (method of paymentMethods; track trackPaymentMethod($index, method.value)) {
                    <button
                      type="button"
                      class="rounded-full px-4 py-2 text-sm font-semibold transition"
                      [class]="paymentMethod() === method.value
                        ? 'bg-brand-500 text-white'
                        : 'border border-gray-200 bg-white text-gray-600'"
                      (click)="paymentMethod.set(method.value)"
                    >
                      {{ method.label }}
                    </button>
                  }
                </div>
              </div>

              <div class="mt-6">
                <label class="text-sm font-semibold text-gray-700">Solicitudes especiales</label>
                <textarea
                  rows="3"
                  class="mt-3 w-full rounded-[24px] border border-gray-200 px-4 py-3 text-sm outline-none"
                  placeholder="Añade cualquier detalle importante"
                  [ngModel]="specialRequests()"
                  (ngModelChange)="specialRequests.set($event ?? '')"
                ></textarea>
              </div>

              <div class="mt-6 rounded-[28px] bg-orange-50 p-5 text-sm text-orange-900">
                Cancelación gratuita hasta {{ excursion.cancellation_hours }} horas antes
              </div>

              <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" class="rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700" (click)="goToStep(2)">Atrás</button>
                <button
                  type="button"
                  class="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  [disabled]="isSubmitting()"
                  (click)="confirmBooking()"
                >
                  {{ isSubmitting() ? 'Confirmando...' : 'Confirmar reserva' }}
                </button>
              </div>
            </section>
          }
        } @else {
          <div class="rounded-[32px] bg-white p-6 text-center text-gray-500 shadow-sm">Cargando experiencia…</div>
        }
      </div>
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

    .success-pop {
      animation: success-pop 0.5s ease-out;
    }

    @keyframes success-pop {
      from {
        transform: scale(0);
      }
      to {
        transform: scale(1);
      }
    }
  `],
})
export class ExcursionBookingPageComponent implements OnInit {
  protected readonly service = inject(ExcursionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly currentStep = signal<1 | 2 | 3>(1);
  protected readonly bookingSuccess = signal(false);
  protected readonly participants = signal<ParticipantForm[]>([]);
  protected readonly selectedDay = signal<string | null>(null);
  protected readonly hotelPickupEnabled = signal(false);
  protected readonly hotelName = signal('');
  protected readonly paymentMethod = signal<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
  protected readonly specialRequests = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly bookingNumber = signal('');
  protected readonly paymentMethods = [
    { value: 'efectivo' as const, label: 'Efectivo 💵' },
    { value: 'tarjeta' as const, label: 'Tarjeta 💳' },
    { value: 'transferencia' as const, label: 'Transferencia 🏦' },
  ];
  protected readonly participantSlots = computed(() => Array.from({ length: this.service.numPeople() }, (_, index) => index));
  protected readonly participantsReady = computed(() => this.participants().every(participant => participant.full_name.trim().length > 0));
  protected readonly dateGroups = computed<DateGroup[]>(() => {
    const groups = new Map<string, DateGroup>();
    for (const slot of this.service.availableDates()) {
      const existing = groups.get(slot.date);
      if (existing) {
        existing.spotsLeft += slot.spots_left;
      } else {
        groups.set(slot.date, {
          date: slot.date,
          label: this.formatDate(slot.date),
          spotsLeft: slot.spots_left,
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
  protected readonly minPeople = computed(() => Math.max(this.service.selectedExcursion()?.min_people ?? 1, 1));
  protected readonly maxPeople = computed(() => {
    const spotsLeft = this.service.selectedDate()?.spots_left ?? 10;
    return Math.max(this.minPeople(), Math.min(spotsLeft, 10));
  });
  protected readonly steps = computed(() => ([
    { index: 1, label: 'Fecha', status: this.currentStep() === 1 ? 'current' : this.currentStep() > 1 ? 'done' : 'pending' },
    { index: 2, label: 'Participantes', status: this.currentStep() === 2 ? 'current' : this.currentStep() > 2 ? 'done' : 'pending' },
    { index: 3, label: 'Confirmar', status: this.currentStep() === 3 ? 'current' : 'pending' },
  ] as const));

  private readonly syncParticipants = effect(() => {
    const count = this.service.numPeople();
    const current = this.participants();
    if (current.length === count) {
      return;
    }

    const next = Array.from({ length: count }, (_, index) => current[index] ?? this.emptyParticipant());
    this.participants.set(next);
  }, { allowSignalWrites: true });

  async ngOnInit(): Promise<void> {
    const excursionId = this.route.snapshot.paramMap.get('id');
    if (!excursionId) {
      return;
    }

    if (this.service.selectedExcursion()?.id !== excursionId) {
      await this.service.loadExcursionDetail(excursionId);
    }

    const selectedDate = this.service.selectedDate() ?? this.service.availableDates()[0] ?? null;
    this.selectedDay.set(selectedDate?.date ?? this.dateGroups()[0]?.date ?? null);
    if (selectedDate) {
      this.service.selectedDate.set(selectedDate);
    }
    this.service.numPeople.set(this.minPeople());
  }

  protected goToStep(step: 1 | 2 | 3): void {
    this.currentStep.set(step);
  }

  protected selectDay(day: string): void {
    this.selectedDay.set(day);
    const firstSlot = this.service.availableDates().find(slot => slot.date === day) ?? null;
    this.service.selectedDate.set(firstSlot);
    this.enforcePeopleBounds();
  }

  protected selectTime(slot: ExcursionDate): void {
    this.service.selectedDate.set(slot);
    this.enforcePeopleBounds();
  }

  protected decrementPeople(): void {
    this.service.numPeople.update(current => Math.max(this.minPeople(), current - 1));
  }

  protected incrementPeople(): void {
    this.service.numPeople.update(current => Math.min(this.maxPeople(), current + 1));
  }

  protected updateParticipant(index: number, field: keyof ParticipantForm, value: string): void {
    this.participants.update(participants => participants.map((participant, participantIndex) => {
      if (participantIndex !== index) {
        return participant;
      }
      return { ...participant, [field]: value };
    }));
  }

  protected useMyData(): void {
    const user = this.authService.currentUser();
    if (!user) {
      return;
    }
    this.participants.update(participants => participants.map((participant, index) => index === 0 ? {
      ...participant,
      full_name: user.full_name ?? participant.full_name,
      phone: ((user as unknown as { phone?: string }).phone) ?? participant.phone,
    } : participant));
  }

  protected async confirmBooking(): Promise<void> {
    const selectedDate = this.service.selectedDate();
    if (!selectedDate) {
      return;
    }

    this.isSubmitting.set(true);
    const booking = await this.service.createBooking({
      excursionDateId: selectedDate.id,
      numPeople: this.service.numPeople(),
      total: this.service.totalPrice(),
      specialRequests: this.buildSpecialRequests(),
      participants: this.participants().map(participant => ({
        full_name: participant.full_name.trim(),
        id_number: participant.id_number.trim() || undefined,
        phone: participant.phone.trim() || undefined,
      })),
    });
    this.isSubmitting.set(false);

    if (!booking) {
      return;
    }

    this.bookingNumber.set(booking.bookingNumber);
    this.bookingSuccess.set(true);
  }

  protected selectedDateLabel(): string {
    const selectedDate = this.service.selectedDate();
    return selectedDate ? this.formatDate(selectedDate.date).split(' / ').join(' ') : 'Pendiente';
  }

  protected successDateLabel(): string {
    const selectedDate = this.service.selectedDate();
    if (!selectedDate) {
      return 'Fecha pendiente';
    }
    return `${this.formatDate(selectedDate.date).split(' / ').join(' ')} · ${this.formatTime(selectedDate.departure_time)}`;
  }

  protected async shareBooking(): Promise<void> {
    const shareText = `Reserva ${this.bookingNumber()} · ${this.service.selectedExcursion()?.name ?? 'Excursión'} · ${this.successDateLabel()}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ text: shareText, title: 'Reserva confirmada' });
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
    }
  }

  protected goBack(): void {
    if (this.currentStep() > 1 && !this.bookingSuccess()) {
      this.currentStep.set((this.currentStep() - 1) as 1 | 2 | 3);
      return;
    }
    void this.router.navigate(['/customer/excursions', this.service.selectedExcursion()?.id]);
  }

  protected goToCatalog(): void {
    void this.router.navigate(['/customer/excursions']);
  }

  protected formatTime(value: string): string {
    return value.slice(0, 5);
  }

  protected trackNumber(_: number, value: number): number {
    return value;
  }

  protected trackStep(_: number, step: { index: number }): number {
    return step.index;
  }

  protected trackDateGroup(_: number, group: DateGroup): string {
    return group.date;
  }

  protected trackSlot(_: number, slot: ExcursionDate): string {
    return slot.id;
  }

  protected trackPaymentMethod(_: number, value: string): string {
    return value;
  }

  private enforcePeopleBounds(): void {
    const current = this.service.numPeople();
    if (current < this.minPeople()) {
      this.service.numPeople.set(this.minPeople());
      return;
    }
    if (current > this.maxPeople()) {
      this.service.numPeople.set(this.maxPeople());
    }
  }

  private emptyParticipant(): ParticipantForm {
    return {
      full_name: '',
      id_number: '',
      phone: '',
    };
  }

  private buildSpecialRequests(): string {
    const details = [
      this.specialRequests().trim(),
      `Pago: ${this.paymentMethod()}`,
      this.hotelPickupEnabled() && this.hotelName().trim() ? `Hotel pickup: ${this.hotelName().trim()}` : '',
    ].filter(Boolean);
    return details.join(' | ');
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
