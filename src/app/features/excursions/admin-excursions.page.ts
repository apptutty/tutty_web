import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { DataTableComponent, TableColumn } from '../../shared/ui/data-table/data-table.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { ExcursionOperator, Excursion, ExcursionDate, BookingStatus } from '../../core/supabase/database.types';

type ActiveTab = 'operadores' | 'excursiones' | 'reservas' | 'categorias';

@Component({
  selector: 'app-excursions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, DataTableComponent, StatusBadgeComponent, RouterLink],
  template: `
    <app-page-header title="Excursiones" subtitle="Gestión de operadores, excursiones y reservas">
      @if (activeTab() === 'operadores') {
        <button class="btn-primary" (click)="openOperatorModal()">+ Operador</button>
      }
      @if (activeTab() === 'excursiones') {
        <button class="btn-primary" (click)="router.navigate(['/excursions/excursion/new'])">+ Excursión</button>
      }
    </app-page-header>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
      @for (tab of tabs; track tab.key) {
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          [class]="activeTab() === tab.key ? 'bg-white text-gray-800 shadow-theme-xs' : 'text-gray-500 hover:text-gray-700'"
          (click)="activeTab.set(tab.key); loadTabData()"
        >{{ tab.label }}</button>
      }
    </div>

    <!-- Operators tab -->
    @if (activeTab() === 'operadores') {
      <div class="mb-4">
        <input type="search" class="input-field max-w-xs" placeholder="Buscar operador..." [(ngModel)]="operatorSearch" />
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <app-data-table
          [columns]="operatorColumns"
          [data]="filteredOperators()"
          [loading]="loading()"
          [totalCount]="filteredOperators().length"
          [pageSize]="filteredOperators().length"
          (rowClick)="router.navigate(['/excursions/operators', $event.id])"
        />
      </div>
    }

    <!-- Excursions tab -->
    @if (activeTab() === 'excursiones') {
      <div class="flex flex-wrap gap-3 mb-4">
        <input type="search" class="input-field max-w-xs" placeholder="Buscar excursión..." [(ngModel)]="excursionSearch" />
        <select class="input-field w-44" [(ngModel)]="difficultyFilter">
          <option value="">Todas las dificultades</option>
          <option value="facil">Fácil</option>
          <option value="moderado">Moderado</option>
          <option value="dificil">Difícil</option>
        </select>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <app-data-table
          [columns]="excursionColumns"
          [data]="filteredExcursions()"
          [loading]="loading()"
          [totalCount]="filteredExcursions().length"
          [pageSize]="filteredExcursions().length"
          (rowClick)="router.navigate(['/excursions/excursion', $event.id])"
        />
      </div>
      <p class="text-xs text-gray-400 mt-1">Haz clic en una excursión para editarla. Para gestionar fechas, usa el botón de fechas en la tabla.</p>
    }

    <!-- Bookings tab -->
    @if (activeTab() === 'reservas') {
      <div class="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <select class="input-field sm:w-48" [(ngModel)]="bookingStatusFilter" (ngModelChange)="loadBookings()">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmada">Confirmada</option>
          <option value="cancelada">Cancelada</option>
          <option value="completada">Completada</option>
        </select>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" class="input-field sm:w-44" [(ngModel)]="bookingDateFrom" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" class="input-field sm:w-44" [(ngModel)]="bookingDateTo" />
        </div>
        @if (bookingDateFrom || bookingDateTo) {
          <button class="btn-secondary text-sm self-end" (click)="bookingDateFrom = ''; bookingDateTo = ''">✕ Fechas</button>
        }
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <app-data-table
          [columns]="bookingColumns"
          [data]="filteredBookings()"
          [loading]="loading()"
          [totalCount]="filteredBookings().length"
          [pageSize]="filteredBookings().length"
          (rowClick)="openBookingDetail($event)"
        />
      </div>
    }

    <!-- Categories tab -->
    @if (activeTab() === 'categorias') {
      <div class="flex justify-end mb-4">
        <a routerLink="/excursions/categories" class="btn-primary text-sm">Gestionar categorías →</a>
      </div>
      <div class="card p-8 text-center text-gray-400">
        <p class="text-3xl mb-2">🏷️</p>
        <p class="text-sm">Administra las categorías de excursiones en la página dedicada.</p>
      </div>
    }

    <!-- Operator Modal -->
    @if (showOperatorModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showOperatorModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold text-gray-800">{{ editingOperator() ? 'Editar operador' : 'Nuevo operador' }}</h3>
            <button class="text-gray-400" (click)="showOperatorModal.set(false)">✕</button>
          </div>
          <form [formGroup]="operatorForm" (ngSubmit)="saveOperator()" class="p-6 space-y-5">

            <!-- Información básica -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información básica</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="label">Nombre *</label>
                  <input class="input-field" formControlName="name" />
                </div>
                <div>
                  <label class="label">Categoría</label>
                  <select class="input-field" formControlName="category">
                    <option value="Playa">Playa</option>
                    <option value="Montaña">Montaña</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Aventura">Aventura</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Gastronomía">Gastronomía</option>
                    <option value="Ecoturismo">Ecoturismo</option>
                  </select>
                </div>
                <div>
                  <label class="label">WhatsApp</label>
                  <input class="input-field" formControlName="whatsapp_number" placeholder="+1 809 000 0000" />
                </div>
                <div>
                  <label class="label">Dirección</label>
                  <input class="input-field" formControlName="address" placeholder="Dirección física" />
                </div>
                <div>
                  <label class="label">Años de experiencia</label>
                  <input class="input-field" formControlName="years_experience" placeholder="ej. 10 años" />
                </div>
                <div class="col-span-2">
                  <label class="label">Descripción</label>
                  <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
                </div>
                <div>
                  <label class="label">URL del logo</label>
                  <input class="input-field" formControlName="logo_url" placeholder="https://..." />
                </div>
                <div>
                  <label class="label">URL del banner</label>
                  <input class="input-field" formControlName="banner_url" placeholder="https://..." />
                </div>
              </div>
            </div>

            <!-- Comisión y legal -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Comisión y legal</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">Tipo de comisión</label>
                  <select class="input-field" formControlName="management_fee_type">
                    <option value="">Sin comisión</option>
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo (RD$)</option>
                  </select>
                </div>
                <div>
                  <label class="label">Valor de comisión</label>
                  <input class="input-field" type="number" min="0" formControlName="management_fee_value" placeholder="ej. 15" />
                </div>
                <div>
                  <label class="label flex items-center gap-2">
                    <input type="checkbox" formControlName="has_tourism_license" class="rounded" />
                    <span>Licencia de turismo</span>
                  </label>
                </div>
                <div>
                  <label class="label">Nº de licencia</label>
                  <input class="input-field" formControlName="tourism_license_number" placeholder="Número de licencia" />
                </div>
                <div class="col-span-2">
                  <label class="label flex items-center gap-2">
                    <input type="checkbox" formControlName="has_insurance" class="rounded" />
                    <span>Cuenta con seguro de actividad</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showOperatorModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="operatorForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Booking detail modal -->
    @if (selectedBooking()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="selectedBooking.set(null); bookingDetail.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold text-gray-800">Reserva {{ selectedBooking()!.booking_number }}</h3>
            <button class="text-gray-400" (click)="selectedBooking.set(null); bookingDetail.set(null)">✕</button>
          </div>
          <div class="p-6 space-y-5">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-400 text-xs">Excursión</p>
                <p class="font-medium">{{ selectedBooking()!.excursion_name }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Fecha excursión</p>
                <p class="font-medium">{{ selectedBooking()!.excursion_date_str }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Cliente</p>
                <p class="font-medium">{{ selectedBooking()!.customer_name }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Personas</p>
                <p class="font-medium">{{ selectedBooking()!.num_people }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Total</p>
                <p class="font-bold text-lg">RD$ {{ selectedBooking()!.total }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Estado</p>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  [class]="bookingStatusClass(selectedBooking()!.status)">
                  {{ selectedBooking()!.status }}
                </span>
              </div>
            </div>
            @if (selectedBooking()!.special_requests) {
              <p class="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">{{ selectedBooking()!.special_requests }}</p>
            }

            <!-- Participants -->
            @if (bookingDetailLoading()) {
              <div class="animate-pulse h-20 bg-gray-100 rounded-lg"></div>
            } @else if (bookingDetail()?.participants?.length) {
              <div>
                <h4 class="text-sm font-semibold text-gray-700 mb-2">Participantes</h4>
                <table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nombre</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Cédula</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (p of bookingDetail()!.participants; track p.id; let i = $index) {
                      <tr>
                        <td class="px-3 py-2 text-xs text-gray-400">{{ i + 1 }}</td>
                        <td class="px-3 py-2 text-sm font-medium text-gray-800">{{ p.full_name }}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">{{ p.cedula ?? '—' }}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">{{ p.phone ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <div class="flex gap-3 pt-2 border-t border-gray-100">
              @if (selectedBooking()!.status === 'pendiente') {
                <button class="btn-primary flex-1" (click)="updateStatus('confirmada')">✓ Confirmar</button>
                <button class="btn-danger flex-1" (click)="updateStatus('cancelada')">✗ Cancelar</button>
              }
              @if (selectedBooking()!.status === 'confirmada') {
                <button class="btn-secondary flex-1" (click)="updateStatus('completada')">✓ Completar</button>
                <button class="btn-danger flex-1" (click)="updateStatus('cancelada')">✗ Cancelar</button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Excursion Dates Modal -->
    @if (showDatesModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="closeDatesModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <div>
              <h3 class="font-semibold text-gray-800">Fechas disponibles</h3>
              <p class="text-xs text-gray-400">{{ selectedExcursion()?.name }}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn-primary text-sm" (click)="showAddDatesModal.set(true)">+ Agregar fechas</button>
              <button class="text-gray-400 hover:text-gray-600" (click)="closeDatesModal()">✕</button>
            </div>
          </div>
          <div class="p-6">
            @if (excursionDatesLoading()) {
              <div class="space-y-3">
                @for (i of [1,2,3]; track i) {
                  <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
                }
              </div>
            } @else if (excursionDates().length === 0) {
              <p class="text-center text-gray-400 py-8">Sin fechas programadas</p>
            } @else {
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Fecha</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Hora salida</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Cupos totales</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Disponibles</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (d of excursionDates(); track d.id) {
                    <tr>
                      <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ d.date }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ d.departure_time }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ d.total_spots }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ d.spots_left }}</td>
                      <td class="px-4 py-3">
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                          [class]="d.is_active ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'">
                          {{ d.is_active ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    }

    <!-- Add Dates Modal -->
    @if (showAddDatesModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showAddDatesModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10">
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between">
            <h3 class="font-semibold">Agregar fechas</h3>
            <button class="text-gray-400" (click)="showAddDatesModal.set(false)">✕</button>
          </div>
          <form (ngSubmit)="addExcursionDates()" class="p-6 space-y-4">
            <div>
              <label class="label">Fechas (selecciona varias)</label>
              <input type="date" class="input-field" [(ngModel)]="newDateInput" name="newDate"
                (change)="addDateToList($event)" />
              <div class="flex flex-wrap gap-2 mt-2">
                @for (d of newDates; track d) {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs">
                    {{ d }}
                    <button type="button" (click)="removeDate(d)" class="text-brand-400">×</button>
                  </span>
                }
              </div>
            </div>
            <div>
              <label class="label">Hora de salida</label>
              <input type="time" class="input-field" [(ngModel)]="newDepartureTime" name="departureTime" />
            </div>
            <div>
              <label class="label">Cupos totales</label>
              <input type="number" class="input-field" [(ngModel)]="newTotalSpots" name="totalSpots" min="1" />
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showAddDatesModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="newDates.length === 0 || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Agregar ' + newDates.length + ' fecha(s)' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
    `,
})
export class ExcursionsPageComponent implements OnInit {
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);

  readonly activeTab = signal<ActiveTab>('operadores');
  readonly operators = signal<ExcursionOperator[]>([]);
  readonly excursions = signal<any[]>([]);
  readonly bookings = signal<any[]>([]);
  readonly loading = signal(true);
  readonly showOperatorModal = signal(false);
  readonly editingOperator = signal<ExcursionOperator | null>(null);
  readonly selectedBooking = signal<any | null>(null);
  readonly bookingDetail = signal<any | null>(null);
  readonly bookingDetailLoading = signal(false);
  readonly saveLoading = signal(false);

  // Dates
  readonly selectedExcursion = signal<any | null>(null);
  readonly excursionDates = signal<ExcursionDate[]>([]);
  readonly excursionDatesLoading = signal(false);
  readonly showDatesModal = signal(false);
  readonly showAddDatesModal = signal(false);
  newDateInput = '';
  newDates: string[] = [];
  newDepartureTime = '08:00';
  newTotalSpots = 20;

  bookingStatusFilter: BookingStatus | '' = '';
  operatorSearch = '';
  excursionSearch = '';
  difficultyFilter = '';
  bookingDateFrom = '';
  bookingDateTo = '';

  readonly filteredOperators = () => {
    let result = this.operators();
    if (this.operatorSearch.trim()) {
      const q = this.operatorSearch.toLowerCase();
      result = result.filter(op => op.name?.toLowerCase().includes(q) || op.category?.toLowerCase().includes(q));
    }
    return result;
  };

  readonly filteredExcursions = () => {
    let result = this.excursions();
    if (this.excursionSearch.trim()) {
      const q = this.excursionSearch.toLowerCase();
      result = result.filter(e => e.name?.toLowerCase().includes(q) || e.operator_name?.toLowerCase().includes(q));
    }
    if (this.difficultyFilter) result = result.filter(e => e.difficulty_level === this.difficultyFilter);
    return result;
  };

  readonly filteredBookings = () => {
    let result = this.bookings();
    if (this.bookingDateFrom) result = result.filter(b => b.excursion_date_str >= this.bookingDateFrom);
    if (this.bookingDateTo) result = result.filter(b => b.excursion_date_str <= this.bookingDateTo);
    return result;
  };

  readonly tabs = [
    { key: 'operadores' as ActiveTab, label: 'Operadores' },
    { key: 'excursiones' as ActiveTab, label: 'Excursiones' },
    { key: 'reservas' as ActiveTab, label: 'Reservas' },
    { key: 'categorias' as ActiveTab, label: 'Categorías' },
  ];

  readonly operatorColumns: TableColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'category', label: 'Categoría' },
    { key: 'avg_rating', label: 'Rating' },
    { key: 'total_reviews', label: 'Reseñas' },
    { key: 'approval_status', label: 'Estado', type: 'badge', badgeType: 'approval' as any },
    { key: 'is_active', label: 'Activo', type: 'boolean' },
  ];

  readonly excursionColumns: TableColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'operator_name', label: 'Operador' },
    { key: 'price_per_person', label: 'Precio/persona', type: 'currency' },
    { key: 'duration_hours', label: 'Duración (h)' },
    { key: 'difficulty_level', label: 'Dificultad' },
    { key: 'min_people', label: 'Mín' },
    { key: 'max_people', label: 'Máx' },
    { key: 'is_active', label: 'Activo', type: 'boolean' },
  ];

  readonly bookingColumns: TableColumn[] = [
    { key: 'booking_number', label: '# Reserva' },
    { key: 'excursion_name', label: 'Excursión' },
    { key: 'customer_name', label: 'Cliente' },
    { key: 'excursion_date_str', label: 'Fecha excursión' },
    { key: 'num_people', label: 'Personas' },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'status', label: 'Estado', type: 'badge', badgeType: 'booking' },
    { key: 'created_at', label: 'Reservado', type: 'date' },
  ];

  readonly operatorForm = this.fb.group({
    name: ['', Validators.required],
    category: ['Playa'],
    whatsapp_number: [''],
    description: [''],
    address: [''],
    years_experience: [''],
    logo_url: [''],
    banner_url: [''],
    management_fee_type: [''],
    management_fee_value: [null as number | null],
    has_tourism_license: [false],
    tourism_license_number: [''],
    has_insurance: [false],
  });

  ngOnInit(): void { this.loadTabData(); }

  loadTabData(): void {
    this.loading.set(true);
    if (this.activeTab() === 'operadores') this.loadOperators();
    else if (this.activeTab() === 'excursiones') this.loadExcursions();
    else if (this.activeTab() === 'reservas') this.loadBookings();
    else this.loading.set(false);
  }

  loadOperators(): void {
    this.service.getOperators().subscribe(data => {
      this.operators.set(data);
      this.loading.set(false);
    });
  }

  loadExcursions(): void {
    if (this.operators().length === 0) {
      this.service.getOperators().subscribe(ops => this.operators.set(ops));
    }
    this.service.getExcursions().subscribe(data => {
      this.excursions.set(data);
      this.loading.set(false);
    });
  }

  loadBookings(): void {
    this.service.getBookings(this.bookingStatusFilter ? { status: this.bookingStatusFilter as BookingStatus } : {})
      .subscribe(data => {
        this.bookings.set(data);
        this.loading.set(false);
      });
  }

  openOperatorModal(op?: ExcursionOperator): void {
    this.editingOperator.set(op ?? null);
    this.operatorForm.reset({
      category: 'Playa',
      has_tourism_license: false,
      has_insurance: false,
    });
    if (op) {
      this.operatorForm.patchValue({
        name: op.name,
        category: op.category ?? 'Playa',
        whatsapp_number: op.whatsapp_number ?? '',
        description: op.description ?? '',
        address: (op as any).address ?? '',
        years_experience: (op as any).years_experience ?? '',
        logo_url: (op as any).logo_url ?? '',
        banner_url: (op as any).banner_url ?? '',
        management_fee_type: (op as any).management_fee_type ?? '',
        management_fee_value: (op as any).management_fee_value ?? null,
        has_tourism_license: (op as any).has_tourism_license ?? false,
        tourism_license_number: (op as any).tourism_license_number ?? '',
        has_insurance: (op as any).has_insurance ?? false,
      });
    }
    this.showOperatorModal.set(true);
  }

  async saveOperator(): Promise<void> {
    if (this.operatorForm.invalid) return;
    this.saveLoading.set(true);
    try {
      const val = this.operatorForm.getRawValue();
      await this.service.saveOperator({
        ...(this.editingOperator() ? { id: this.editingOperator()!.id } : {}),
        name: val.name!,
        slug: val.name!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        category: val.category || null,
        whatsapp_number: val.whatsapp_number || null,
        description: val.description || null,
        address: val.address || null,
        years_experience: val.years_experience || null,
        logo_url: val.logo_url || null,
        banner_url: val.banner_url || null,
        management_fee_type: (val.management_fee_type as 'percentage' | 'fixed' | null) || null,
        management_fee_value: val.management_fee_value ?? null,
        has_tourism_license: val.has_tourism_license ?? false,
        tourism_license_number: val.tourism_license_number || null,
        has_insurance: val.has_insurance ?? false,
        is_active: true,
        avg_rating: 0,
        total_reviews: 0,
      } as any);
      this.toastService.success('Operador guardado');
      this.showOperatorModal.set(false);
      this.loadOperators();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.saveLoading.set(false); }
  }

  openBookingDetail(booking: any): void {
    this.router.navigate(['/excursions/bookings', booking.id]);
  }

  openDatesModal(excursion: any): void {
    this.selectedExcursion.set(excursion);
    this.showDatesModal.set(true);
    this.excursionDatesLoading.set(true);
    this.service.getExcursionDates(excursion.id).subscribe(dates => {
      this.excursionDates.set(dates);
      this.excursionDatesLoading.set(false);
    });
  }

  closeDatesModal(): void {
    this.showDatesModal.set(false);
    this.showAddDatesModal.set(false);
    this.selectedExcursion.set(null);
    this.newDates = [];
    this.newDateInput = '';
  }

  addDateToList(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val && !this.newDates.includes(val)) {
      this.newDates = [...this.newDates, val].sort();
    }
    this.newDateInput = '';
    (event.target as HTMLInputElement).value = '';
  }

  removeDate(d: string): void { this.newDates = this.newDates.filter(x => x !== d); }

  async addExcursionDates(): Promise<void> {
    if (!this.newDates.length || !this.selectedExcursion()) return;
    this.saveLoading.set(true);
    try {
      await this.service.addExcursionDates(
        this.selectedExcursion()!.id,
        this.newDates,
        this.newDepartureTime,
        this.newTotalSpots,
      );
      this.toastService.success(`${this.newDates.length} fecha(s) agregadas`);
      this.newDates = [];
      this.newDateInput = '';
      this.showAddDatesModal.set(false);
      this.excursionDatesLoading.set(true);
      this.service.getExcursionDates(this.selectedExcursion()!.id).subscribe(dates => {
        this.excursionDates.set(dates);
        this.excursionDatesLoading.set(false);
      });
    } catch { this.toastService.error('Error al agregar fechas'); }
    finally { this.saveLoading.set(false); }
  }

  bookingStatusClass(status: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-warning-100 text-warning-700',
      confirmada: 'bg-brand-100 text-brand-700',
      completada: 'bg-success-100 text-success-700',
      cancelada: 'bg-error-100 text-error-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  async updateStatus(status: BookingStatus): Promise<void> {
    if (!this.selectedBooking()) return;
    try {
      await this.service.updateBookingStatus(this.selectedBooking()!.id, status);
      this.toastService.success('Estado actualizado');
      this.selectedBooking.set(null);
      this.bookingDetail.set(null);
      this.loadBookings();
    } catch { this.toastService.error('Error al actualizar'); }
  }
}

