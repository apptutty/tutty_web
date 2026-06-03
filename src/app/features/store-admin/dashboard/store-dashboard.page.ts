import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StoreAdminService } from '../store-admin.service';
import { StoreDashboardService, StoreKPIs, ActiveOrder, TopProduct, SalesDay, LowStockItem } from './store-dashboard.service';
import { OpenCloseToggleComponent } from './open-close-toggle.component';

const STATUS_CFG: Record<string, { label: string; classes: string; pulse: boolean }> = {
    recibido: { label: 'Nuevo', classes: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200', pulse: true },
    confirmado: { label: 'Confirmado', classes: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200', pulse: false },
    en_preparacion: { label: 'Preparando', classes: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', pulse: false },
    en_camino: { label: 'En camino', classes: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', pulse: false },
};

const NEXT_BTN: Record<string, string> = {
    recibido: 'Confirmar',
    confirmado: 'Preparando',
    en_preparacion: 'Listo',
};

@Component({
    selector: 'app-store-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, OpenCloseToggleComponent],
    template: `
    <div class="p-6 lg:p-8 space-y-6">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p class="text-gray-500 mt-0.5 text-sm">{{ storeName() }} &middot; {{ today }}</p>
        </div>
        <app-open-close-toggle class="w-full sm:w-auto" />
      </div>

      <!-- Row 1: KPI Cards -->
      @if (kpisLoading()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (n of skeleton; track n) {
            <div class="card p-5 animate-pulse">
              <div class="h-3 w-20 bg-gray-200 rounded mb-3"></div>
              <div class="h-7 w-14 bg-gray-200 rounded"></div>
            </div>
          }
        </div>
      } @else {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <!-- Ventas -->
          <div class="card p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Ventas hoy</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">RD&#36;{{ sales() }}</p>
              </div>
              <div class="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">Ticket prom. RD&#36;{{ avgTicket() }}</p>
          </div>

          <!-- Pedidos -->
          <div class="card p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Pedidos hoy</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ orderCount() }}</p>
              </div>
              <div class="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">{{ cancellations() }} cancelados</p>
          </div>

          <!-- Activos -->
          <div class="card p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Activos ahora</p>
                <p class="text-2xl font-bold mt-1"
                  [class.text-brand-600]="activeOrdering() > 0"
                  [class.text-gray-900]="activeOrdering() === 0"
                >{{ activeOrdering() }}</p>
              </div>
              <div class="w-9 h-9 rounded-xl flex items-center justify-center"
                [class.bg-brand-50]="activeOrdering() > 0"
                [class.bg-gray-50]="activeOrdering() === 0">
                <svg class="w-5 h-5"
                  [class.text-brand-600]="activeOrdering() > 0"
                  [class.text-gray-400]="activeOrdering() === 0"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">En preparaci&#243;n / camino</p>
          </div>

          <!-- Rating -->
          <div class="card p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Calificaci&#243;n</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ rating() }}</p>
              </div>
              <div class="w-9 h-9 rounded-xl bg-yellow-50 flex items-center justify-center">
                <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">{{ totalReviews() }} rese&#241;as</p>
          </div>

        </div>
      }

      <!-- Row 2: Active Orders -->
      <div class="card overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-gray-900">Pedidos activos</h2>
            @if (activeOrders().length > 0) {
              <span class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                {{ activeOrders().length }}
              </span>
            }
          </div>
          <p class="text-xs text-gray-400">Actualiza cada 30 seg</p>
        </div>

        @if (activeOrders().length === 0) {
          <div class="py-12 text-center text-gray-400">
            <svg class="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm font-medium">Sin pedidos activos</p>
          </div>
        } @else {
          <div class="divide-y divide-gray-50">
            @for (order of activeOrders(); track order.id) {
              <div class="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <span class="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  [ngClass]="statusCfg(order.status).classes">
                  @if (statusCfg(order.status).pulse) {
                    <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  }
                  {{ statusCfg(order.status).label }}
                </span>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-900 text-sm">#{{ order.order_number }}</span>
                    <span class="text-gray-600 text-sm truncate">{{ order.customer_name }}</span>
                  </div>
                  <p class="text-xs text-gray-400 mt-0.5 truncate">{{ itemSummary(order) }}</p>
                </div>

                <div class="flex-shrink-0 text-right hidden sm:block">
                  <p class="text-xs text-gray-400">{{ elapsed(order.created_at) }}</p>
                  <p class="text-sm font-semibold text-gray-800 mt-0.5">RD&#36;{{ fmtN(order.total) }}</p>
                </div>

                @if (nextBtn(order.status)) {
                  <button
                    class="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                    (click)="advanceStatus(order)">
                    {{ nextBtn(order.status) }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Row 3: Charts + Top Products -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

        <!-- Weekly bar chart -->
        <div class="lg:col-span-3 card p-5">
          <h2 class="font-semibold text-gray-900 mb-4">Ventas &#250;ltimos 7 d&#237;as</h2>
          @if (weeklySales().length === 0) {
            <div class="h-40 flex items-center justify-center text-gray-300 text-sm">Cargando...</div>
          } @else {
            <div class="flex items-end gap-2 h-40">
              @for (day of weeklySales(); track day.date) {
                <div class="flex flex-col items-center gap-1 flex-1">
                  <span class="text-xs text-gray-400" style="font-size:10px">
                    {{ day.sales > 0 ? fmtN(day.sales) : '' }}
                  </span>
                  <div class="w-full rounded-t-md transition-all duration-500"
                    style="background:linear-gradient(180deg,#FF3C97 0%,#c0195e 100%);min-height:4px"
                    [style.height.%]="barH(day.sales)">
                  </div>
                  <span class="text-gray-500 font-medium" style="font-size:10px">{{ day.date }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Top 5 products -->
        <div class="lg:col-span-2 card p-5">
          <h2 class="font-semibold text-gray-900 mb-4">Top productos hoy</h2>
          @if (topProducts().length === 0) {
            <div class="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
              <svg class="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
              Sin ventas hoy
            </div>
          } @else {
            <div class="space-y-3">
              @for (p of topProducts(); track p.name; let i = $index) {
                <div class="flex items-center gap-3">
                  <span class="text-sm font-bold text-gray-300 w-4 text-right">{{ i + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ p.name }}</p>
                    <div class="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div class="h-full rounded-full bg-brand-400 transition-all duration-500"
                        [style.width.%]="topBarW(p.totalSold)">
                      </div>
                    </div>
                  </div>
                  <span class="flex-shrink-0 text-sm font-semibold text-gray-700">{{ p.totalSold }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Row 4: Inventory alerts -->
      @if (hasInventoryAlerts()) {
        <div class="card overflow-hidden">
          <div class="flex items-center gap-3 px-5 py-4 border-b border-orange-100 bg-orange-50">
            <svg class="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <h2 class="font-semibold text-orange-800">Alertas de inventario</h2>
              <p class="text-xs text-orange-600 mt-0.5">{{ inventoryAlertSummary() }}</p>
            </div>
          </div>

          <div class="divide-y divide-gray-50">
            @for (item of lowStockItems(); track item.id) {
              <div class="flex items-center gap-4 px-5 py-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ item.name }}</p>
                  <p class="text-xs mt-0.5"
                    [class.text-red-600]="item.stock_count === 0"
                    [class.text-amber-600]="item.stock_count !== 0">
                    {{ stockLabel(item) }}
                  </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  @if (editingStockId() === item.id) {
                    <input type="number" min="0"
                      class="input-field w-20 text-center text-sm py-1"
                      [(ngModel)]="editingStockValue"
                      (keydown.enter)="saveStock(item.id)" />
                    <button class="btn-primary text-xs px-2.5 py-1" (click)="saveStock(item.id)">Guardar</button>
                    <button class="btn-secondary text-xs px-2.5 py-1" (click)="editingStockId.set(null)">&#10005;</button>
                  } @else {
                    <button
                      class="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors"
                      (click)="startEditStock(item)">Actualizar stock</button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

    </div>
  `,
})
export class StoreDashboardPageComponent implements OnInit, OnDestroy {
    private readonly storeService = inject(StoreAdminService);
    private readonly dashService = inject(StoreDashboardService);
    private readonly subs: Subscription[] = [];

    readonly skeleton = [1, 2, 3, 4];
    readonly today = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
    editingStockValue = 0;

    readonly kpis = signal<StoreKPIs | null>(null);
    readonly kpisLoading = signal(true);
    readonly activeOrders = signal<ActiveOrder[]>([]);
    readonly topProducts = signal<TopProduct[]>([]);
    readonly weeklySales = signal<SalesDay[]>([]);
    readonly lowStockItems = signal<LowStockItem[]>([]);
    readonly editingStockId = signal<string | null>(null);

    // Derived KPI helpers (avoid complex optional chaining in template)
    readonly storeName = computed(() => this.storeService.activeStore()?.name ?? '');
    readonly sales = computed(() => this.fmtN(this.kpis()?.sales ?? 0));
    readonly avgTicket = computed(() => this.fmtN(this.kpis()?.avgTicket ?? 0));
    readonly orderCount = computed(() => this.kpis()?.orderCount ?? 0);
    readonly cancellations = computed(() => this.kpis()?.cancellations ?? 0);
    readonly activeOrdering = computed(() => this.kpis()?.activeOrders ?? 0);
    readonly rating = computed(() => (this.kpis()?.rating ?? 0).toFixed(1));
    readonly totalReviews = computed(() => this.storeService.activeStore()?.total_reviews ?? 0);

    readonly maxWeekly = computed(() => Math.max(...this.weeklySales().map(d => d.sales), 1));
    readonly maxTop = computed(() => Math.max(...this.topProducts().map(p => p.totalSold), 1));

    readonly hasInventoryAlerts = computed(() => {
        const k = this.kpis();
        if (k?.lowStockCount == null) return false;
        return (k.outOfStockCount ?? 0) > 0 || (k.lowStockCount ?? 0) > 0;
    });

    readonly inventoryAlertSummary = computed(() => {
        const k = this.kpis();
        if (!k) return '';
        const parts: string[] = [];
        if ((k.outOfStockCount ?? 0) > 0) parts.push(`${k.outOfStockCount} sin stock`);
        if ((k.lowStockCount ?? 0) > 0) parts.push(`${k.lowStockCount} con stock bajo`);
        return parts.join(' · ');
    });

    ngOnInit(): void {
        const storeId = this.storeService.activeStoreId();
        const commerceType = this.storeService.activeStore()?.commerce_type ?? '';
        if (!storeId) return;

        this.subs.push(
            this.dashService.getTodayKPIs(storeId, commerceType).subscribe(k => {
                this.kpis.set(k);
                this.kpisLoading.set(false);
            }),
            this.dashService.getActiveOrders(storeId).subscribe(o => this.activeOrders.set(o)),
            this.dashService.getTopProducts(storeId).subscribe(p => this.topProducts.set(p)),
            this.dashService.getWeeklySales(storeId).subscribe(s => this.weeklySales.set(s)),
            this.dashService.getLowStockItems(storeId).subscribe(i => this.lowStockItems.set(i)),
        );
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    statusCfg(status: string) {
        return STATUS_CFG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600', pulse: false };
    }

    nextBtn(status: string): string | null {
        return NEXT_BTN[status] ?? null;
    }

    async advanceStatus(order: ActiveOrder) {
        const next = await this.dashService.advanceOrderStatus(order.id, order.status);
        if (next) {
            this.activeOrders.update(list =>
                list.map(o => o.id === order.id ? { ...o, status: next } : o)
            );
        }
    }

    itemSummary(order: ActiveOrder): string {
        const first2 = order.items.slice(0, 2).map(i => i.quantity + 'x ' + i.name).join(', ');
        const extra = order.items.length - 2;
        return extra > 0 ? first2 + ' y ' + extra + ' mas' : first2;
    }

    elapsed(createdAt: string): string {
        const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
        if (diff < 60) return diff + ' min';
        const h = Math.floor(diff / 60);
        return h + 'h ' + (diff % 60) + 'm';
    }

    fmtN(n: number): string {
        return Math.round(n).toLocaleString('es-DO');
    }

    barH(sales: number): number {
        const max = this.maxWeekly();
        return max > 0 ? Math.max(5, Math.round((sales / max) * 100)) : 5;
    }

    topBarW(sold: number): number {
        const max = this.maxTop();
        return max > 0 ? Math.round((sold / max) * 100) : 0;
    }

    stockLabel(item: LowStockItem): string {
        if ((item.stock_count ?? 0) === 0) return 'Sin stock';
        const base = 'Stock: ' + item.stock_count;
        return item.low_stock_alert ? base + ' · Minimo: ' + item.low_stock_alert : base;
    }

    startEditStock(item: LowStockItem) {
        this.editingStockId.set(item.id);
        this.editingStockValue = item.stock_count ?? 0;
    }

    async saveStock(itemId: string) {
        await this.dashService.updateStock(itemId, this.editingStockValue);
        const newVal = this.editingStockValue;
        this.lowStockItems.update(list =>
            list.map(i => i.id === itemId ? { ...i, stock_count: newVal } : i)
                .filter(i => i.low_stock_alert == null || (i.stock_count ?? 0) <= i.low_stock_alert || (i.stock_count ?? 0) === 0)
        );
        this.editingStockId.set(null);
    }
}
