import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CouriersService } from './couriers.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';

@Component({
  selector: 'app-courier-detail-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <app-page-header
      [title]="courier()?.full_name ?? 'Repartidor'"
      subtitle="Detalle del repartidor">
      <button class="btn-secondary" (click)="router.navigate(['/couriers'])">← Volver</button>
    </app-page-header>

    @if (loading()) {
      <div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    } @else if (courier()) {
      <!-- Header Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="card p-5 flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-2xl font-bold text-brand-600">
            {{ courier()!.full_name?.charAt(0) ?? '?' }}
          </div>
          <div>
            <p class="font-semibold text-gray-900">{{ courier()!.full_name }}</p>
            <p class="text-sm text-gray-500">{{ courier()!.email }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ courier()!.phone }}</p>
          </div>
        </div>
        <div class="card p-5">
          <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Rating</p>
          <p class="text-2xl font-bold text-gray-800">⭐ {{ courier()!.avg_rating?.toFixed(1) ?? '0.0' }}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Entregas</p>
          <p class="text-2xl font-bold text-gray-800">{{ courier()!.total_deliveries ?? 0 }}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Ganancias</p>
          <p class="text-2xl font-bold text-gray-800">RD$ {{ courier()!.total_earnings?.toFixed(0) ?? '0' }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left column -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Delivery history -->
          <div class="card p-0 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 class="font-semibold text-gray-800">Historial de entregas</h3>
              <span class="text-sm text-gray-400">{{ historyTotal() }} entregas</span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pedido</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Restaurante</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @if (historyLoading()) {
                    @for (i of [1,2,3,4,5]; track i) {
                      <tr class="animate-pulse">
                        @for (j of [1,2,3,4,5]; track j) {
                          <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                        }
                      </tr>
                    }
                  } @else if (history().length === 0) {
                    <tr>
                      <td colspan="5" class="px-4 py-8 text-center text-gray-400 text-sm">Sin entregas registradas</td>
                    </tr>
                  } @else {
                    @for (order of history(); track order.id) {
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ order.order_number }}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{{ order.restaurant_name }}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{{ order.customer_name }}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-700">RD$ {{ order.total }}</td>
                        <td class="px-4 py-3 text-sm text-gray-400">{{ order.created_at | date:'dd/MM/yy HH:mm' }}</td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            <!-- Pagination -->
            @if (historyTotal() > pageSize) {
              <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p class="text-xs text-gray-400">
                  Mostrando {{ (historyPage() - 1) * pageSize + 1 }}–{{ [historyPage() * pageSize, historyTotal()].at(-1) === historyPage() * pageSize ? historyPage() * pageSize : historyTotal() }} de {{ historyTotal() }}
                </p>
                <div class="flex gap-2">
                  <button class="btn-secondary text-xs px-3 py-1" [disabled]="historyPage() === 1" (click)="changePage(historyPage() - 1)">←</button>
                  <button class="btn-secondary text-xs px-3 py-1" [disabled]="historyPage() * pageSize >= historyTotal()" (click)="changePage(historyPage() + 1)">→</button>
                </div>
              </div>
            }
          </div>

          <!-- Ratings -->
          <div class="card p-0 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100">
              <h3 class="font-semibold text-gray-800">Calificaciones recientes</h3>
            </div>
            @if (ratingsLoading()) {
              <div class="p-6">
                @for (i of [1,2,3]; track i) {
                  <div class="animate-pulse h-16 bg-gray-200 rounded mb-3"></div>
                }
              </div>
            } @else if (ratings().length === 0) {
              <p class="px-6 py-8 text-center text-gray-400 text-sm">Sin calificaciones aún</p>
            } @else {
              <ul class="divide-y divide-gray-100">
                @for (r of ratings(); track r.id) {
                  <li class="px-6 py-4">
                    <div class="flex justify-between items-start">
                      <div>
                        <p class="text-sm font-medium text-gray-800">{{ r.customer_name }}</p>
                        @if (r.comment) {
                          <p class="text-sm text-gray-500 mt-0.5">{{ r.comment }}</p>
                        }
                      </div>
                      <div class="text-right">
                        <p class="text-sm font-semibold text-warning-600">⭐ {{ r.rating }}</p>
                        <p class="text-xs text-gray-400 mt-0.5">{{ r.created_at | date:'dd/MM/yy' }}</p>
                      </div>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <!-- Right column -->
        <div class="space-y-6">
          <!-- Estado actual -->
          <div class="card p-5">
            <h3 class="font-semibold text-gray-800 mb-3">Estado actual</h3>
            <div class="flex items-center gap-3 mb-3">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                [class]="courier()!.is_available ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
                <span class="w-2 h-2 rounded-full"
                  [class]="courier()!.is_available ? 'bg-success-500 animate-pulse' : 'bg-gray-400'"></span>
                {{ courier()!.is_available ? 'Disponible' : 'No disponible' }}
              </span>
            </div>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Vehículo</span>
                <span class="font-medium text-gray-800">{{ vehicleLabel(courier()!.vehicle_type) }}</span>
              </div>
              @if (courier()!.vehicle_plate) {
                <div class="flex justify-between">
                  <span class="text-gray-500">Placa</span>
                  <span class="font-medium text-gray-800">{{ courier()!.vehicle_plate }}</span>
                </div>
              }
              @if (courier()!.cedula) {
                <div class="flex justify-between">
                  <span class="text-gray-500">Cédula</span>
                  <span class="font-medium text-gray-800">{{ courier()!.cedula }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    } @else {
      <div class="py-24 text-center text-gray-400">
        <p class="text-3xl mb-2">🛵</p>
        <p>Repartidor no encontrado</p>
      </div>
    }
  `,
})
export class CourierDetailPageComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(CouriersService);
  private readonly toastService = inject(ToastService);

  readonly courier = signal<any | null>(null);
  readonly loading = signal(true);
  readonly history = signal<any[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly historyLoading = signal(true);
  readonly ratings = signal<any[]>([]);
  readonly ratingsLoading = signal(true);

  readonly pageSize = 15;
  private courierId = '';

  ngOnInit(): void {
    this.courierId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCourier();
  }

  loadCourier(): void {
    this.loading.set(true);
    this.service.getCourierById(this.courierId).subscribe({
      next: data => {
        this.courier.set(data);
        this.loading.set(false);
        this.loadHistory();
        this.loadRatings();
      },
      error: () => {
        this.toastService.error('Error al cargar el repartidor');
        this.loading.set(false);
      },
    });
  }

  loadHistory(page = 1): void {
    this.historyLoading.set(true);
    this.historyPage.set(page);
    this.service.getDeliveryHistory(this.courierId, page, this.pageSize).subscribe(({ data, count }) => {
      this.history.set(data);
      this.historyTotal.set(count);
      this.historyLoading.set(false);
    });
  }

  loadRatings(): void {
    this.ratingsLoading.set(true);
    this.service.getRatings(this.courierId).subscribe(data => {
      this.ratings.set(data);
      this.ratingsLoading.set(false);
    });
  }

  changePage(page: number): void {
    this.loadHistory(page);
  }

  vehicleLabel(type: string): string {
    const map: Record<string, string> = {
      moto: '🏍️ Moto', bicicleta: '🚲 Bicicleta', carro: '🚗 Carro', a_pie: '🚶 A pie',
    };
    return map[type] ?? type;
  }
}
