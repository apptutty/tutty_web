import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrdersService } from './orders.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { CurrencyDopPipe } from '../../shared/pipes/currency-dop.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { OrderDetail, OrderStatus, Courier } from '../../core/supabase/database.types';
import { TuttyMapComponent } from '../../shared/ui/map/tutty-map.component';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

const STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus[]>> = {
  recibido: ['confirmado', 'cancelado'],
  confirmado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['en_camino'],
  en_camino: ['entregado'],
};

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, PageHeaderComponent,
    StatusBadgeComponent, CurrencyDopPipe, TimeAgoPipe, TuttyMapComponent, AdminEmptyStateComponent,
  ],
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center py-24">
        <div class="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
      </div>
    } @else if (order()) {
      <app-page-header eyebrow="Operations · Order Trace" [title]="orderTitle()" subtitle="Detalle completo del flujo operativo, cliente, repartidor y estados.">
        <button class="btn-secondary" (click)="router.navigate(['/orders'])">← Volver</button>
        @if (nextStatuses().length > 0) {
          <button class="btn-primary" (click)="showStatusModal.set(true)">
            🔄 Cambiar estado
          </button>
        }
      </app-page-header>

      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <p class="text-xs font-extrabold text-[#7b8496]">Estado actual</p>
          <p class="mt-1 text-sm font-black text-[#111827]">{{ statusLabels[order()!.status] }}</p>
        </article>
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <p class="text-xs font-extrabold text-[#7b8496]">Total</p>
          <p class="mt-1 text-sm font-black text-[#111827]">{{ order()!.total | currencyDop }}</p>
        </article>
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <p class="text-xs font-extrabold text-[#7b8496]">Repartidor</p>
          <p class="mt-1 text-sm font-black text-[#111827]">{{ order()!.repartidor_name || 'Sin asignar' }}</p>
        </article>
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <p class="text-xs font-extrabold text-[#7b8496]">Creado</p>
          <p class="mt-1 text-sm font-black text-[#111827]">{{ order()!.created_at | timeAgo }}</p>
        </article>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <!-- Left: main order content (3/5) -->
        <div class="lg:col-span-3 space-y-4">
          <!-- Status & timeline -->
          <div class="rounded-3xl border border-[#e7eaf1] bg-white p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="font-semibold text-gray-800">Estado del pedido</h2>
                <p class="text-xs text-gray-400 mt-0.5">{{ order()!.created_at | timeAgo }}</p>
              </div>
              <app-status-badge [status]="order()!.status" />
            </div>
            <!-- Timeline -->
            <div class="space-y-3">
              @for (h of order()!.status_history; track h.id) {
                <div class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-2.5 h-2.5 rounded-full bg-brand-500 mt-1 flex-shrink-0"></div>
                    @if (!$last) { <div class="w-0.5 flex-1 bg-gray-200 mt-1"></div> }
                  </div>
                  <div class="pb-3">
                    <app-status-badge [status]="h.status" />
                    <p class="text-xs text-gray-400 mt-1">{{ h.created_at | timeAgo }}</p>
                    @if (h.notes) { <p class="text-xs text-gray-600 mt-0.5">{{ h.notes }}</p> }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Items -->
          <div class="rounded-3xl border border-[#e7eaf1] bg-white p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
            <h2 class="font-semibold text-gray-800 mb-4">Items del pedido</h2>
            <div class="space-y-3">
              @for (item of order()!.items; track item.id) {
                <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800">
                      {{ item.quantity }}× {{ getItemName(item.menu_item_snapshot) }}
                    </p>
                    <p class="text-xs text-gray-400">{{ item.unit_price | currencyDop }} c/u</p>
                  </div>
                  <p class="text-sm font-semibold text-gray-800">{{ item.subtotal | currencyDop }}</p>
                </div>
              }
            </div>
            <!-- Totals -->
            <div class="mt-4 pt-4 border-t border-gray-200 space-y-1.5">
              <div class="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{{ order()!.subtotal | currencyDop }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-600">
                <span>Delivery</span><span>{{ order()!.delivery_fee | currencyDop }}</span>
              </div>
              @if (order()!.discount_amount > 0) {
                <div class="flex justify-between text-sm text-success-600">
                  <span>Descuento</span><span>-{{ order()!.discount_amount | currencyDop }}</span>
                </div>
              }
              <div class="flex justify-between text-base font-bold text-gray-800 pt-1 border-t border-gray-200">
                <span>TOTAL</span><span>{{ order()!.total | currencyDop }}</span>
              </div>
            </div>
            @if (order()!.special_instructions) {
              <div class="mt-4 p-3 bg-warning-50 rounded-lg border border-warning-100">
                <p class="text-xs font-semibold text-warning-700 mb-1">📝 Instrucciones especiales</p>
                <p class="text-xs text-warning-700">{{ order()!.special_instructions }}</p>
              </div>
            }
          </div>
        </div>

        <!-- Right: info cards (2/5) -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Restaurant -->
          <div class="rounded-3xl border border-[#e7eaf1] bg-white p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">🏪 Restaurante</h3>
            <p class="text-sm font-medium text-gray-700">{{ order()!.commerce_name }}</p>
          </div>

          <!-- Customer -->
          <div class="rounded-3xl border border-[#e7eaf1] bg-white p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">👤 Cliente</h3>
            <p class="text-sm font-medium text-gray-700">{{ order()!.customer_name }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ order()!.customer_phone }}</p>
            <p class="text-xs text-gray-500 mt-1">📍 {{ order()!.delivery_street }}{{ order()!.delivery_sector ? ', ' + order()!.delivery_sector : '' }}{{ order()!.delivery_city ? ', ' + order()!.delivery_city : '' }}</p>
            @if (order()!.delivery_lat && order()!.delivery_lng) {
              <div class="mt-3">
                <app-tutty-map
                  mode="view"
                  [lat]="order()!.delivery_lat"
                  [lng]="order()!.delivery_lng"
                  height="180px"
                  mapClass="rounded-lg overflow-hidden border border-gray-200"
                />
              </div>
            }
          </div>

          <!-- Repartidor -->
          <div class="rounded-3xl border border-[#e7eaf1] bg-white p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">🛵 Repartidor</h3>
            @if (order()!.repartidor_id) {
              <p class="text-sm font-medium text-gray-700">{{ order()!.repartidor_name }}</p>
              <p class="text-xs text-gray-500">
                {{ order()!.vehicle_type }} · Placa: {{ order()!.vehicle_plate ?? 'N/A' }}
              </p>
              <p class="text-xs text-gray-500">⭐ {{ order()!.repartidor_rating }}/5</p>
            } @else {
              <p class="text-sm text-gray-400 mb-3">Sin asignar</p>
              @if (['confirmado', 'en_preparacion'].includes(order()!.status)) {
                <button class="btn-secondary w-full" (click)="loadAndShowCouriers()">
                  🛵 Asignar repartidor
                </button>
              }
            }
          </div>
        </div>
      </div>

      <!-- Status change modal -->
      @if (showStatusModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" (click)="showStatusModal.set(false)"></div>
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <h3 class="font-semibold text-gray-800 mb-4">Cambiar estado del pedido</h3>
            <div class="space-y-4">
              <div>
                <label class="label">Nuevo estado</label>
                <select class="input-field" [(ngModel)]="selectedStatus">
                  @for (s of nextStatuses(); track s) {
                    <option [value]="s">{{ statusLabels[s] }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="label">Notas (opcional)</label>
                <textarea class="input-field resize-none" rows="3" [(ngModel)]="statusNotes"
                  placeholder="Motivo del cambio..."></textarea>
              </div>
            </div>
            <div class="flex gap-3 justify-end mt-6">
              <button class="btn-secondary" (click)="showStatusModal.set(false)">Cancelar</button>
              <button class="btn-primary" [disabled]="statusLoading()" (click)="changeStatus()">
                @if (statusLoading()) { Guardando... } @else { Confirmar }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Assign repartidor modal -->
      @if (showCourierModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" (click)="showCourierModal.set(false)"></div>
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <h3 class="font-semibold text-gray-800 mb-4">Asignar repartidor</h3>
            @if (couriersLoading()) {
              <div class="py-8 text-center text-gray-400 animate-pulse">Cargando...</div>
            } @else {
              <div class="space-y-2 max-h-72 overflow-y-auto">
                @for (r of availableCouriers(); track r.id) {
                  <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input type="radio" name="repartidor" [value]="r.id" [(ngModel)]="selectedCourierId" />
                    <div>
                      <p class="text-sm font-medium text-gray-800">{{ r.full_name }}</p>
                      <p class="text-xs text-gray-500">{{ r.vehicle_type }} · ⭐ {{ r.avg_rating }}</p>
                    </div>
                  </label>
                }
                @if (availableCouriers().length === 0) {
                  <app-admin-empty-state
                    icon="users"
                    title="No hay repartidores disponibles"
                    description="Intenta nuevamente en unos minutos."
                    variant="soft" />
                }
              </div>
            }
            <div class="flex gap-3 justify-end mt-4">
              <button class="btn-secondary" (click)="showCourierModal.set(false)">Cancelar</button>
              <button class="btn-primary" [disabled]="!selectedCourierId" (click)="assignCourier()">
                Asignar
              </button>
            </div>
          </div>
        </div>
      }
    } @else {
      <div class="py-10">
        <app-admin-empty-state
          icon="orders"
          title="Pedido no encontrado"
          description="No se pudo cargar la información del pedido."
          variant="soft" />
      </div>
    }
  `,
})
export class OrderDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(OrdersService);
  private readonly toastService = inject(ToastService);
  readonly router = inject(Router);

  readonly order = signal<OrderDetail | null>(null);
  readonly loading = signal(true);
  readonly showStatusModal = signal(false);
  readonly showCourierModal = signal(false);
  readonly statusLoading = signal(false);
  readonly couriersLoading = signal(false);
  readonly availableCouriers = signal<Courier[]>([]);

  selectedStatus: OrderStatus = 'confirmado';
  selectedCourierId: string | null = null;
  statusNotes = '';

  readonly statusLabels: Record<OrderStatus, string> = {
    recibido: 'Recibido',
    confirmado: 'Confirmado',
    en_preparacion: 'En preparación',
    en_camino: 'En camino',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.ordersService.getOrderById(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
        const next = this.nextStatuses();
        if (next.length > 0) this.selectedStatus = next[0];
      },
      error: () => {
        this.loading.set(false);
        this.toastService.error('Error al cargar el pedido');
      },
    });
  }

  nextStatuses(): OrderStatus[] {
    return STATUS_FLOW[this.order()?.status as OrderStatus] ?? [];
  }

  orderTitle(): string {
    const o = this.order();
    if (!o) return 'Pedido';
    if (o.order_number) return `Pedido #${o.order_number}`;
    return `Pedido ${o.id.slice(0, 8).toUpperCase()}`;
  }

  getItemName(snapshot: any): string {
    if (!snapshot) return '—';
    if (typeof snapshot === 'string') {
      try { snapshot = JSON.parse(snapshot); } catch { return snapshot; }
    }
    return snapshot?.name ?? '—';
  }

  async changeStatus(): Promise<void> {
    if (!this.order()) return;
    this.statusLoading.set(true);
    try {
      await this.ordersService.updateOrderStatus(this.order()!.id, this.selectedStatus, this.statusNotes);
      this.toastService.success('Estado actualizado correctamente');
      this.showStatusModal.set(false);
      this.statusNotes = '';
      // Reload
      this.ordersService.getOrderById(this.order()!.id).subscribe(o => this.order.set(o));
    } catch {
      this.toastService.error('Error al actualizar el estado');
    } finally {
      this.statusLoading.set(false);
    }
  }

  loadAndShowCouriers(): void {
    this.showCourierModal.set(true);
    this.couriersLoading.set(true);
    this.ordersService.getAvailableCouriers().subscribe(list => {
      this.availableCouriers.set(list);
      this.couriersLoading.set(false);
    });
  }

  async assignCourier(): Promise<void> {
    if (!this.selectedCourierId || !this.order()) return;
    try {
      await this.ordersService.assignCourier(this.order()!.id, this.selectedCourierId);
      this.toastService.success('Repartidor asignado correctamente');
      this.showCourierModal.set(false);
      this.ordersService.getOrderById(this.order()!.id).subscribe(o => this.order.set(o));
    } catch {
      this.toastService.error('Error al asignar repartidor');
    }
  }
}
