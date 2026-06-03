import {
    Component, OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { StoreOrdersService, StoreOrder } from './store-orders.service';
import { StoreAdminService } from '../store-admin.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { OrderStatus } from '../../../core/supabase/database.types';

type ViewTab = 'kanban' | 'lista' | 'mapa';

const STATUS_LABELS: Record<OrderStatus, string> = {
    recibido: 'Nuevo',
    confirmado: 'Confirmado',
    en_preparacion: 'En preparación',
    en_camino: 'En camino',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
    recibido: 'bg-yellow-100 text-yellow-800',
    confirmado: 'bg-blue-100 text-blue-800',
    en_preparacion: 'bg-purple-100 text-purple-800',
    en_camino: 'bg-brand-50 text-brand-700',
    entregado: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800',
};

interface KanbanColumn {
    title: string;
    statuses: OrderStatus[];
    advanceLabel: string;
    color: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
    { title: 'Nuevos', statuses: ['recibido'], advanceLabel: 'Confirmar', color: 'border-yellow-400 bg-yellow-50' },
    { title: 'Preparando', statuses: ['confirmado', 'en_preparacion'], advanceLabel: 'Listo', color: 'border-purple-400 bg-purple-50' },
    { title: 'Listo / En camino', statuses: ['en_camino'], advanceLabel: 'Entregado', color: 'border-brand-500 bg-brand-50' },
    { title: 'Entregados', statuses: ['entregado'], advanceLabel: '', color: 'border-green-400 bg-green-50' },
];

@Component({
    selector: 'app-store-orders',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="p-4 lg:p-6 space-y-4 h-full flex flex-col">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p class="text-sm text-gray-500">{{ totalOrders() }} pedidos activos</p>
        </div>

        <!-- View Tabs -->
        <div class="flex rounded-lg border border-gray-200 bg-gray-50 p-1 self-start sm:self-auto">
          @for (tab of tabs; track tab.id) {
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              [class]="activeView() === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'"
              (click)="setView(tab.id)"
            >
              <span>{{ tab.icon }}</span>
              <span class="hidden sm:inline">{{ tab.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- List filters (shown only in list view) -->
      @if (activeView() === 'lista') {
        <div class="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Buscar por # pedido..."
            class="input-field h-9 text-sm w-48"
            [(ngModel)]="filterSearch"
            (ngModelChange)="onFilterChange()"
          />
          <select class="input-field h-9 text-sm w-40" [(ngModel)]="filterStatus" (ngModelChange)="onFilterChange()">
            <option value="">Todos los estados</option>
            <option value="activos">Activos</option>
            <option value="recibido">Nuevos</option>
            <option value="confirmado">Confirmados</option>
            <option value="en_preparacion">En preparación</option>
            <option value="en_camino">En camino</option>
            <option value="entregado">Entregados</option>
            <option value="cancelado">Cancelados</option>
          </select>
          <input type="date" class="input-field h-9 text-sm w-36" [(ngModel)]="filterDateFrom" (ngModelChange)="onFilterChange()" />
          <input type="date" class="input-field h-9 text-sm w-36" [(ngModel)]="filterDateTo" (ngModelChange)="onFilterChange()" />
        </div>
      }

      <!-- Loading skeleton -->
      @if (isLoading()) {
        <div class="flex gap-4">
          @for (i of [1,2,3,4]; track i) {
            <div class="flex-1 rounded-xl bg-gray-100 animate-pulse h-40"></div>
          }
        </div>
      }

      <!-- ── KANBAN VIEW ─────────────────────────────────────────────────── -->
      @if (!isLoading() && activeView() === 'kanban') {
        <div class="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
          @for (col of kanbanColumns; track col.title) {
            <div class="flex flex-col flex-shrink-0 w-72 rounded-xl border-2 {{ col.color }} min-h-0">
              <!-- Column header -->
              <div class="px-3 py-2.5 border-b border-current/10 flex items-center gap-2">
                <span class="font-semibold text-sm text-gray-700">{{ col.title }}</span>
                <span class="ml-auto bg-white rounded-full px-2 py-0.5 text-xs font-bold text-gray-600 shadow-sm">
                  {{ ordersForColumn(col.statuses).length }}
                </span>
              </div>
              <!-- Cards -->
              <div class="flex-1 overflow-y-auto p-2 space-y-2">
                @for (order of ordersForColumn(col.statuses); track order.id) {
                  <div
                    class="bg-white rounded-lg shadow-sm border p-3 cursor-pointer hover:shadow-md transition-shadow"
                    [class.ring-2]="isUrgent(order)"
                    [class.ring-yellow-400]="isUrgent(order)"
                    [class.animate-pulse-border]="isUrgent(order)"
                    (click)="goToDetail(order.id)"
                  >
                    <!-- Order number + time -->
                    <div class="flex items-start justify-between mb-2">
                      <span class="text-xs font-bold text-gray-700">#{{ order.order_number }}</span>
                      <span class="text-xs text-gray-400">{{ elapsedLabel(order.created_at) }}</span>
                    </div>
                    <!-- Customer -->
                    <p class="text-xs text-gray-600 mb-1 truncate">{{ order.customer_name }}</p>
                    <!-- Items preview -->
                    <p class="text-xs text-gray-400 truncate mb-2">{{ order.items_preview }}</p>
                    <!-- Total -->
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-bold text-gray-900">RD$ {{ order.total | number:'1.0-0' }}</span>
                      @if (isUrgent(order)) {
                        <span class="text-xs bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5 font-semibold">¡+5 min!</span>
                      }
                    </div>
                    <!-- Action buttons -->
                    @if (col.statuses.includes('recibido') && order.status === 'recibido') {
                      <div class="flex gap-1.5 mt-2" (click)="$event.stopPropagation()">
                        <button
                          class="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                          [disabled]="advancingId() === order.id"
                          (click)="advanceOrder(order, $event)"
                        >
                          @if (advancingId() === order.id) { Procesando… } @else { Confirmar }
                        </button>
                        <button
                          class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          (click)="openRejectModal(order, $event)"
                        >
                          ✕
                        </button>
                      </div>
                    } @else if (col.advanceLabel && nextStatus(order.status)) {
                      <div (click)="$event.stopPropagation()">
                        <button
                          class="w-full mt-2 text-xs font-semibold py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                          [disabled]="advancingId() === order.id"
                          (click)="advanceOrder(order, $event)"
                        >
                          @if (advancingId() === order.id) { Procesando… } @else { {{ col.advanceLabel }} →  }
                        </button>
                      </div>
                    }
                  </div>
                }
                @if (ordersForColumn(col.statuses).length === 0) {
                  <p class="text-xs text-center text-gray-400 py-6">Sin pedidos</p>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ── LIST VIEW ──────────────────────────────────────────────────── -->
      @if (!isLoading() && activeView() === 'lista') {
        <div class="card overflow-hidden flex-1 min-h-0 flex flex-col">
          <div class="overflow-auto flex-1">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">Pedido</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">Cliente</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase hidden md:table-cell">Ítems</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">Estado</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase">Total</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase hidden sm:table-cell">Hora</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (order of listOrders(); track order.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 font-mono text-xs font-bold text-gray-700">#{{ order.order_number }}</td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-gray-900">{{ order.customer_name }}</p>
                      <p class="text-xs text-gray-400">{{ order.customer_phone }}</p>
                    </td>
                    <td class="px-4 py-3 text-gray-500 hidden md:table-cell text-xs max-w-xs truncate">{{ order.items_preview }}</td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" [class]="statusColor(order.status)">
                        {{ statusLabel(order.status) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right font-bold text-gray-900">RD$ {{ order.total | number:'1.0-0' }}</td>
                    <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{{ formatTime(order.created_at) }}</td>
                    <td class="px-4 py-3">
                      <a
                        [routerLink]="['/store/orders', order.id]"
                        class="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >Ver →</a>
                    </td>
                  </tr>
                }
                @if (listOrders().length === 0) {
                  <tr>
                    <td colspan="7" class="px-4 py-12 text-center text-gray-400">Sin pedidos para los filtros seleccionados</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm text-gray-600">
              <span>Página {{ currentPage() }} de {{ totalPages() }}</span>
              <div class="flex gap-2">
                <button class="btn-secondary text-xs px-3 py-1.5" [disabled]="currentPage() === 1" (click)="prevPage()">← Anterior</button>
                <button class="btn-secondary text-xs px-3 py-1.5" [disabled]="currentPage() === totalPages()" (click)="nextPage()">Siguiente →</button>
              </div>
            </div>
          }
        </div>
      }

      <!-- ── MAP VIEW ────────────────────────────────────────────────────── -->
      @if (!isLoading() && activeView() === 'mapa') {
        <div class="card flex-1 flex items-center justify-center min-h-64">
          <div class="text-center text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            <p class="font-medium">Mapa de pedidos</p>
            <p class="text-sm mt-1">Vista de mapa disponible próximamente</p>
          </div>
        </div>
      }

    </div>

    <!-- ── REJECT MODAL ───────────────────────────────────────────────────── -->
    @if (rejectModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" (click)="closeRejectModal()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold text-gray-900 mb-1">Rechazar pedido</h3>
          <p class="text-sm text-gray-500 mb-4">Pedido #{{ rejectModal()?.order_number }} — Indica el motivo para el cliente</p>
          <div class="space-y-2 mb-4">
            @for (reason of rejectReasons; track reason) {
              <button
                class="w-full text-left text-sm px-4 py-2.5 rounded-lg border transition-all"
                [class]="rejectReason() === reason ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-gray-200 hover:bg-gray-50'"
                (click)="rejectReason.set(reason)"
              >
                {{ reason }}
              </button>
            }
            <input
              type="text"
              placeholder="Otro motivo..."
              class="input-field text-sm"
              [(ngModel)]="customRejectReason"
            />
          </div>
          <div class="flex gap-3">
            <button class="btn-secondary flex-1" (click)="closeRejectModal()">Cancelar</button>
            <button
              class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              [disabled]="!finalRejectReason() || rejectingId() !== null"
              (click)="confirmReject()"
            >
              @if (rejectingId() !== null) { Rechazando… } @else { Rechazar pedido }
            </button>
          </div>
        </div>
      </div>
    }
  `,
    styles: [`
    .text-brand-600 { color: #e91e8c; }
    .text-brand-700 { color: #c5176d; }
    .bg-brand-600 { background-color: #e91e8c; }
    .bg-brand-700 { background-color: #c5176d; }
    .hover\\:bg-brand-700:hover { background-color: #c5176d; }
    .bg-brand-50 { background-color: #fdf2f8; }
    .text-brand-700 { color: #9d174d; }
    .border-brand-500 { border-color: #e91e8c; }
    .border-brand-400 { border-color: #f43f8e; }
    .ring-brand-400 { --tw-ring-color: #f43f8e; }
    :host { display: block; height: 100%; }
  `],
})
export class StoreOrdersPageComponent implements OnInit, OnDestroy {
    private readonly ordersService = inject(StoreOrdersService);
    private readonly storeAdminService = inject(StoreAdminService);
    private readonly toast = inject(ToastService);
    private readonly router = inject(Router);

    // ── Signals ────────────────────────────────────────────────────────────────
    readonly isLoading = signal(true);
    readonly activeView = signal<ViewTab>('kanban');
    readonly allOrders = signal<StoreOrder[]>([]);
    readonly listOrders = signal<StoreOrder[]>([]);
    readonly totalOrders = signal(0);
    readonly totalCount = signal(0);
    readonly currentPage = signal(1);
    readonly advancingId = signal<string | null>(null);
    readonly rejectingId = signal<string | null>(null);
    readonly rejectModal = signal<StoreOrder | null>(null);
    readonly rejectReason = signal<string>('');

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.PAGE_SIZE)));

    // ── View tabs ──────────────────────────────────────────────────────────────
    readonly tabs = [
        { id: 'kanban' as ViewTab, label: 'Kanban', icon: '🗂' },
        { id: 'lista' as ViewTab, label: 'Lista', icon: '📋' },
        { id: 'mapa' as ViewTab, label: 'Mapa', icon: '🗺' },
    ];

    readonly kanbanColumns = KANBAN_COLUMNS;
    readonly rejectReasons = [
        'Producto no disponible',
        'Cocina cerrada / sin capacidad',
        'Dirección de entrega fuera de zona',
        'Pedido duplicado',
    ];
    customRejectReason = '';

    readonly finalRejectReason = computed(() => this.customRejectReason.trim() || this.rejectReason());

    // ── List filters ───────────────────────────────────────────────────────────
    filterSearch = '';
    filterStatus = 'activos';
    filterDateFrom = '';
    filterDateTo = '';
    private readonly PAGE_SIZE = 30;

    private kanbanSub: Subscription | null = null;

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    ngOnInit(): void {
        this.loadKanbanOrders();
        this.setupRealtime();
    }

    ngOnDestroy(): void {
        this.kanbanSub?.unsubscribe();
        this.ordersService.unsubscribe();
    }

    // ── Data loading ───────────────────────────────────────────────────────────
    private loadKanbanOrders(): void {
        const storeId = this.storeAdminService.activeStoreId();
        if (!storeId) return;

        this.isLoading.set(true);
        this.kanbanSub = this.ordersService.getLiveOrders(storeId).subscribe({
            next: ({ data }) => {
                this.allOrders.set(data);
                this.totalOrders.set(data.length);
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar los pedidos');
                this.isLoading.set(false);
            },
        });
    }

    private loadListOrders(): void {
        const storeId = this.storeAdminService.activeStoreId();
        if (!storeId) return;

        this.isLoading.set(true);
        this.ordersService.getMyOrders(storeId, {
            status: (this.filterStatus as any) || null,
            search: this.filterSearch || undefined,
            date_from: this.filterDateFrom || undefined,
            date_to: this.filterDateTo || undefined,
            page: this.currentPage(),
            pageSize: this.PAGE_SIZE,
        }).subscribe({
            next: ({ data, count }) => {
                this.listOrders.set(data);
                this.totalCount.set(count);
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar los pedidos');
                this.isLoading.set(false);
            },
        });
    }

    private setupRealtime(): void {
        const storeId = this.storeAdminService.activeStoreId();
        if (!storeId) return;

        this.ordersService.subscribeToNewOrders(storeId, (order) => {
            this.playNewOrderSound();
            this.toast.info(`🔔 Nuevo pedido #${order.order_number} — RD$ ${order.total?.toLocaleString('es-DO') ?? '—'}`);
            // Refresh kanban immediately
            const id = this.storeAdminService.activeStoreId()!;
            this.ordersService.getMyOrders(id, { status: 'activos' }).subscribe({
                next: ({ data }) => this.allOrders.set(data),
            });
        });
    }

    private playNewOrderSound(): void {
        try {
            const audio = new Audio('/assets/sounds/new-order.mp3');
            audio.volume = 0.7;
            audio.play().catch(() => {
                // Fallback: Web Audio API beep
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            });
        } catch {
            // Ignore if audio not supported
        }
    }

    // ── View switching ─────────────────────────────────────────────────────────
    setView(tab: ViewTab): void {
        this.activeView.set(tab);
        if (tab === 'lista') {
            this.currentPage.set(1);
            this.loadListOrders();
        }
    }

    onFilterChange(): void {
        this.currentPage.set(1);
        this.loadListOrders();
    }

    prevPage(): void {
        if (this.currentPage() > 1) {
            this.currentPage.update(p => p - 1);
            this.loadListOrders();
        }
    }

    nextPage(): void {
        if (this.currentPage() < this.totalPages()) {
            this.currentPage.update(p => p + 1);
            this.loadListOrders();
        }
    }

    // ── Kanban helpers ─────────────────────────────────────────────────────────
    ordersForColumn(statuses: OrderStatus[]): StoreOrder[] {
        return this.allOrders().filter(o => statuses.includes(o.status));
    }

    isUrgent(order: StoreOrder): boolean {
        if (order.status !== 'recibido') return false;
        const minutes = (Date.now() - new Date(order.created_at).getTime()) / 60_000;
        return minutes > 5;
    }

    elapsedLabel(createdAt: string): string {
        const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    }

    nextStatus(current: OrderStatus): OrderStatus | null {
        return this.ordersService.nextStatus(current);
    }

    async advanceOrder(order: StoreOrder, event: Event): Promise<void> {
        event.stopPropagation();
        const next = this.nextStatus(order.status);
        if (!next || this.advancingId() === order.id) return;

        this.advancingId.set(order.id);
        try {
            await this.ordersService.updateStatus(order.id, next);
            this.allOrders.update(orders =>
                orders.map(o => o.id === order.id ? { ...o, status: next } : o),
            );
            this.toast.success(`Pedido #${order.order_number} → ${STATUS_LABELS[next]}`);
        } catch {
            this.toast.error('No se pudo actualizar el estado');
        } finally {
            this.advancingId.set(null);
        }
    }

    goToDetail(id: string): void {
        this.router.navigate(['/store/orders', id]);
    }

    // ── Reject modal ───────────────────────────────────────────────────────────
    openRejectModal(order: StoreOrder, event: Event): void {
        event.stopPropagation();
        this.rejectModal.set(order);
        this.rejectReason.set('');
        this.customRejectReason = '';
    }

    closeRejectModal(): void {
        if (this.rejectingId() !== null) return;
        this.rejectModal.set(null);
    }

    async confirmReject(): Promise<void> {
        const order = this.rejectModal();
        const reason = this.finalRejectReason();
        if (!order || !reason) return;

        this.rejectingId.set(order.id);
        try {
            await this.ordersService.rejectOrder(order.id, reason);
            this.allOrders.update(orders => orders.filter(o => o.id !== order.id));
            this.toast.success(`Pedido #${order.order_number} rechazado`);
            this.rejectModal.set(null);
        } catch {
            this.toast.error('No se pudo rechazar el pedido');
        } finally {
            this.rejectingId.set(null);
        }
    }

    // ── List helpers ───────────────────────────────────────────────────────────
    statusLabel(status: OrderStatus): string { return STATUS_LABELS[status] ?? status; }
    statusColor(status: OrderStatus): string { return STATUS_COLORS[status] ?? ''; }

    formatTime(iso: string): string {
        return new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    }
}
