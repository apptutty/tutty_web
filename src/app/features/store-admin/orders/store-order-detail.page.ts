import {
    Component, OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { StoreOrdersService, StoreOrderDetail } from './store-orders.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { OrderStatus } from '../../../core/supabase/database.types';

const STATUS_LABELS: Record<OrderStatus, string> = {
    recibido: 'Nuevo',
    confirmado: 'Confirmado',
    en_preparacion: 'En preparación',
    en_camino: 'En camino',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
    recibido: 'bg-yellow-100 text-yellow-700',
    confirmado: 'bg-blue-100 text-blue-700',
    en_preparacion: 'bg-purple-100 text-purple-700',
    en_camino: 'bg-pink-100 text-pink-700',
    entregado: 'bg-green-100 text-green-700',
    cancelado: 'bg-red-100 text-red-700',
};

const STATUS_ORDER: OrderStatus[] = ['recibido', 'confirmado', 'en_preparacion', 'en_camino', 'entregado'];

@Component({
    selector: 'app-store-order-detail',
    standalone: true,
    imports: [CommonModule, RouterLink],
    styles: [`
    :host { display: block; }
    .print-only { display: none; }
    .step-active { background-color: #e91e8c; }
    @media print {
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      body { font-size: 12px; }
      .card { box-shadow: none; border: 1px solid #eee; }
    }
  `],
    template: `
    <div class="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">

      <!-- Header -->
      <div class="flex items-center gap-3 no-print">
        <a routerLink="../" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </a>
        <div class="flex-1">
          <h1 class="text-xl font-bold text-gray-900">
            Pedido #{{ order()?.order_number ?? '…' }}
          </h1>
          @if (order()) {
            <span class="inline-flex mt-0.5 items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" [class]="statusColor(order()!.status)">
              {{ statusLabel(order()!.status) }}
            </span>
          }
        </div>
        <!-- Action buttons -->
        @if (order()) {
          <div class="flex gap-2 no-print">
            @if (order()!.customer_phone) {
              <a
                [href]="whatsappUrl()"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.855L.057 23.5l5.784-1.517A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 01-5.004-1.371l-.359-.213-3.432.9.916-3.346-.234-.375A9.82 9.82 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818 5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
                </svg>
                WhatsApp
              </a>
            }
            <button
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              (click)="printTicket()"
            >
              🖨 Imprimir ticket
            </button>
          </div>
        }
      </div>

      <!-- Loading skeleton -->
      @if (isLoading()) {
        <div class="space-y-4">
          @for (i of [1,2,3]; track i) {
            <div class="card p-4 animate-pulse">
              <div class="h-4 bg-gray-100 rounded w-1/3 mb-3"></div>
              <div class="h-3 bg-gray-100 rounded w-2/3 mb-2"></div>
              <div class="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          }
        </div>
      }

      @if (!isLoading() && order()) {
        <!-- Status progress bar -->
        <div class="card p-4 no-print">
          <div class="flex items-center gap-1">
            @for (s of statusSteps; track s; let i = $index) {
              <div class="flex-1 flex flex-col items-center gap-1">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                  [class]="statusStepColor(s)"
                >
                  @if (isPastStatus(s)) { ✓ } @else { {{ i + 1 }} }
                </div>
                <span class="text-xs text-center text-gray-500 leading-tight hidden sm:block">{{ statusLabel(s) }}</span>
              </div>
              @if (i < statusSteps.length - 1) {
                <div class="flex-1 h-0.5 mb-4" [class]="isPastStatus(statusSteps[i + 1]) || order()!.status === statusSteps[i + 1] ? 'bg-green-400' : 'bg-gray-200'"></div>
              }
            }
          </div>
        </div>

        <!-- Advance status buttons -->
        @if (canAdvance()) {
          <div class="no-print">
            <button
              class="w-full py-3 rounded-xl font-semibold text-white transition-colors"
              style="background-color: #e91e8c;"
              [disabled]="advancingStatus()"
              (click)="advanceStatus()"
            >
              @if (advancingStatus()) { Procesando… }
              @else { Marcar como {{ statusLabel(nextStatusValue()!) }} → }
            </button>
          </div>
        }

        <!-- Customer info -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Cliente</h3>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-500">
              {{ order()!.customer_name[0]?.toUpperCase() ?? '?' }}
            </div>
            <div>
              <p class="font-semibold text-gray-900">{{ order()!.customer_name }}</p>
              @if (order()!.customer_phone) {
                <p class="text-sm text-gray-500">{{ order()!.customer_phone }}</p>
              }
            </div>
          </div>
          @if (order()!.delivery_street) {
            <div class="mt-3 text-sm text-gray-600 flex items-start gap-2">
              <span class="mt-0.5">📍</span>
              <span>{{ deliveryAddress() }}</span>
            </div>
          }
          @if (order()!.special_instructions) {
            <div class="mt-2 text-sm text-gray-600 flex items-start gap-2 bg-yellow-50 rounded-lg p-2.5">
              <span>📝</span>
              <span>{{ order()!.special_instructions }}</span>
            </div>
          }
        </div>

        <!-- Order items -->
        <div class="card overflow-hidden">
          <div class="p-4 border-b border-gray-100">
            <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ítems del pedido</h3>
          </div>
          <div class="divide-y divide-gray-50">
            @for (item of orderItemsForDisplay(); track item.id) {
              <div class="flex items-center gap-3 px-4 py-3">
                <span class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {{ item.quantity }}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ item.name }}</p>
                </div>
                <span class="font-semibold text-gray-900">RD$ {{ item.lineTotal | number:'1.0-0' }}</span>
              </div>
            }
          </div>
          <!-- Totals -->
          <div class="p-4 bg-gray-50 space-y-1.5 text-sm">
            <div class="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>RD$ {{ order()?.subtotal ?? 0 | number:'1.0-0' }}</span>
            </div>
            @if (order()!.discount_amount > 0) {
              <div class="flex justify-between text-green-600">
                <span>Descuento</span>
                <span>−RD$ {{ order()!.discount_amount | number:'1.0-0' }}</span>
              </div>
            }
            <div class="flex justify-between text-gray-600">
              <span>Envío</span>
              <span>RD$ {{ order()!.delivery_fee | number:'1.0-0' }}</span>
            </div>
            <div class="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t border-gray-200">
              <span>Total</span>
              <span>RD$ {{ order()!.total | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <!-- Repartidor info -->
        @if (order()!.repartidor_id) {
          <div class="card p-4">
            <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Repartidor</h3>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">🛵</div>
              <div>
                <p class="font-semibold text-gray-900">{{ order()!.repartidor_name ?? '—' }}</p>
                <p class="text-sm text-gray-500">{{ order()!.vehicle_type }} · {{ order()!.vehicle_plate ?? 'Sin placa' }}</p>
              </div>
              <div class="ml-auto text-sm font-semibold text-yellow-600">⭐ {{ order()!.repartidor_rating | number:'1.1-1' }}</div>
            </div>
          </div>
        }

        <!-- Status history timeline -->
        @if (orderStatusHistory().length > 0) {
          <div class="card p-4 no-print">
            <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial</h3>
            <div class="space-y-3">
              @for (h of orderStatusHistory(); track h.id) {
                <div class="flex items-start gap-3">
                  <div class="w-2.5 h-2.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" style="background-color:#e91e8c"></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-800">{{ statusLabel(h.status) }}</span>
                      @if (h.changed_by_user?.full_name) {
                        <span class="text-xs text-gray-400">por {{ h.changed_by_user?.full_name }}</span>
                      }
                    </div>
                    @if (h.notes) {
                      <p class="text-xs text-gray-500 mt-0.5">{{ h.notes }}</p>
                    }
                    <p class="text-xs text-gray-400">{{ formatDateTime(h.created_at) }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Print-only receipt placeholder -->
        <div class="print-only">
          <p class="font-bold text-lg">Tutty - Ticket de pedido</p>
        </div>

      }

      <!-- Error state -->
      @if (!isLoading() && !order()) {
        <div class="card p-10 text-center text-gray-400">
          <p class="font-medium">No se pudo cargar el pedido</p>
          <a routerLink="../" class="text-sm text-brand-600 mt-2 inline-block" style="color:#e91e8c">Volver a pedidos</a>
        </div>
      }

    </div>
  `,
})
export class StoreOrderDetailPageComponent implements OnInit, OnDestroy {
    private readonly ordersService = inject(StoreOrdersService);
    private readonly toast = inject(ToastService);
    private readonly route = inject(ActivatedRoute);

    readonly isLoading = signal(true);
    readonly order = signal<StoreOrderDetail | null>(null);
    readonly advancingStatus = signal(false);

    readonly statusSteps: OrderStatus[] = ['recibido', 'confirmado', 'en_preparacion', 'en_camino', 'entregado'];

    readonly orderStatusHistory = computed(() => this.order()?.status_history ?? []);

    readonly repartidorName = computed(() => this.order()?.repartidor_name ?? '—');

    readonly deliveryAddress = computed(() => {
        const o = this.order();
        return [o?.delivery_street, o?.delivery_sector, o?.delivery_city].filter(v => !!v).join(', ') || '—';
    });

    readonly orderItemsForDisplay = computed(() =>
        (this.order()?.items ?? []).map(item => ({
            id: item.id,
            name: this.itemName(item),
            quantity: item.quantity,
            unitPrice: item.unit_price,
            lineTotal: item.unit_price * item.quantity,
        }))
    );

    readonly nextStatusValue = computed(() => {
        const o = this.order();
        if (!o) return null;
        return this.ordersService.nextStatus(o.status);
    });

    readonly canAdvance = computed(() => {
        const o = this.order();
        if (!o) return false;
        if (o.status === 'cancelado' || o.status === 'entregado') return false;
        return this.nextStatusValue() !== null;
    });

    readonly whatsappUrl = computed(() => {
        const o = this.order();
        if (!o?.customer_phone) return '#';
        const phone = o.customer_phone.replace(/\D/g, '');
        const text = encodeURIComponent(
            `Hola ${o.customer_name}, tu pedido #${o.order_number} en Tutty está siendo procesado. ¡Gracias por tu compra!`,
        );
        return `https://wa.me/${phone}?text=${text}`;
    });

    private sub: any = null;

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;
        this.sub = this.ordersService.getOrderDetail(id).subscribe({
            next: (detail) => {
                this.order.set(detail);
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('No se pudo cargar el detalle del pedido');
                this.isLoading.set(false);
            },
        });
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe?.();
    }

    statusLabel(status: OrderStatus): string { return STATUS_LABELS[status] ?? status; }
    statusColor(status: OrderStatus): string { return STATUS_COLORS[status] ?? ''; }

    itemName(item: any): string {
        const snap = item.menu_item_snapshot;
        if (!snap) return '—';
        return (snap as any).name ?? (snap as any).nombre ?? '—';
    }

    isPastStatus(status: OrderStatus): boolean {
        const o = this.order();
        if (!o || o.status === 'cancelado') return false;
        const currentIdx = STATUS_ORDER.indexOf(o.status);
        const checkIdx = STATUS_ORDER.indexOf(status);
        return checkIdx < currentIdx;
    }

    statusStepColor(status: OrderStatus): string {
        const o = this.order();
        if (!o) return 'bg-gray-100 text-gray-400';
        if (o.status === status) return 'step-active text-white';
        if (this.isPastStatus(status)) return 'bg-green-400 text-white';
        return 'bg-gray-100 text-gray-400';
    }

    async advanceStatus(): Promise<void> {
        const o = this.order();
        const next = this.nextStatusValue();
        if (!o || !next || this.advancingStatus()) return;

        this.advancingStatus.set(true);
        try {
            await this.ordersService.updateStatus(o.id, next);
            this.order.update(ord => ord ? { ...ord, status: next } : ord);
            this.toast.success(`Estado actualizado: ${this.statusLabel(next)}`);
        } catch {
            this.toast.error('No se pudo actualizar el estado');
        } finally {
            this.advancingStatus.set(false);
        }
    }

    printTicket(): void {
        const o = this.order();
        if (!o) return;

        const itemRows = this.orderItemsForDisplay()
            .map(item => `<tr><td>${item.quantity}x ${item.name}</td><td style="text-align:right">RD$${item.lineTotal.toLocaleString('es-DO')}</td></tr>`)
            .join('');

        const win = window.open('', '_blank', 'width=400,height=600');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Ticket #${o.order_number}</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 16px; }
        h2 { text-align: center; margin: 0 0 4px; }
        p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        td { padding: 2px 0; }
        hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
        .total { font-weight: bold; font-size: 14px; }
        .center { text-align: center; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <h2>Tutty</h2>
      <p class="center">Ticket de pedido</p>
      <p class="center">#${o.order_number}</p>
      <hr/>
      <p>Cliente: ${o.customer_name ?? '—'}</p>
      <p>Dirección: ${o.delivery_street ? [o.delivery_street, o.delivery_sector, o.delivery_city].filter(Boolean).join(', ') : '—'}</p>
      <hr/>
      <table>${itemRows}</table>
      <hr/>
      <p class="total">Total: RD$${o.total?.toLocaleString('es-DO') ?? '—'}</p>
      <hr/>
      <p class="center" style="color:#999;font-size:10px;">Generado por Tutty</p>
      <script>window.print();window.close();</script>
    </body></html>`);
        win.document.close();
    }

    formatDateTime(iso: string): string {
        return new Date(iso).toLocaleString('es-DO', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
    }
}
