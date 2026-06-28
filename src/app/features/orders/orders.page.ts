import {
  Component, OnInit, OnDestroy, inject, signal, computed, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DataTableComponent, TableColumn } from '../../shared/ui/data-table/data-table.component';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { OrderStatus, OrderFilters } from '../../core/supabase/database.types';

type StatusTab = 'todos' | 'activos' | OrderStatus;

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, PageHeaderComponent],
  template: `
    <app-page-header title="Pedidos" subtitle="Gestión en tiempo real">
      @if (newOrderAlert()) {
        <div class="flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-lg px-3 py-1.5 text-sm text-warning-700 animate-pulse">
          📦 {{ newOrderAlert() }}
        </div>
      }
      <button class="btn-secondary text-sm" (click)="loadOrders()" [disabled]="loading()">
        {{ loading() ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </app-page-header>

    <!-- KPI summary -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <div class="admin-metric-card">
        <p class="text-xs text-gray-500">Resultados totales</p>
        <p class="text-2xl font-bold text-gray-800">{{ totalCount() }}</p>
      </div>
      <div class="admin-metric-card">
        <p class="text-xs text-gray-500">Activos (página actual)</p>
        <p class="text-2xl font-bold text-warning-600">{{ activeOnPage() }}</p>
      </div>
      <div class="admin-metric-card">
        <p class="text-xs text-gray-500">Entregados (página actual)</p>
        <p class="text-2xl font-bold text-success-600">{{ deliveredOnPage() }}</p>
      </div>
      <div class="admin-metric-card">
        <p class="text-xs text-gray-500">Cancelados (página actual)</p>
        <p class="text-2xl font-bold text-error-600">{{ cancelledOnPage() }}</p>
      </div>
    </div>

    <div class="admin-toolbar">
      <div class="overflow-x-auto scrollbar-hide w-full lg:w-auto">
        <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-max min-w-full sm:w-fit">
          @for (tab of statusTabs; track tab.key) {
            <button
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0"
              [class]="activeTab() === tab.key
                ? 'bg-white text-gray-800 shadow-theme-xs'
                : 'text-gray-500 hover:text-gray-700'"
              (click)="setTab(tab.key)"
            >{{ tab.label }}</button>
          }
        </div>
      </div>

      <div class="relative flex-1 min-w-[220px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="search"
          class="input-field pl-9 w-full"
          placeholder="Buscar por # pedido..."
          [(ngModel)]="searchText"
          (ngModelChange)="onSearchChange()"
        />
      </div>
      <select class="input-field sm:w-44" [(ngModel)]="dateRange" (ngModelChange)="applyDateFilter()">
        <option value="today">Hoy</option>
        <option value="yesterday">Ayer</option>
        <option value="week">Esta semana</option>
        <option value="month">Este mes</option>
      </select>
    </div>

    @if (loadError()) {
      <div class="mb-4 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 flex items-center gap-3">
        <span>⚠️</span>
        <span class="flex-1">{{ loadError() }}</span>
        <button class="btn-secondary text-xs" (click)="loadOrders()">Reintentar</button>
      </div>
    }

    <!-- Table -->
    <div class="admin-table-card">
      <app-data-table
        [columns]="columns"
        [data]="orders()"
        [loading]="loading()"
        [totalCount]="totalCount()"
        [pageSize]="pageSize"
        [currentPage]="currentPage()"
        (pageChange)="onPageChange($event)"
        (rowClick)="goToDetail($event)"
      />
    </div>
  `,
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private readonly ordersService = inject(OrdersService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly orders = signal<any[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly activeTab = signal<StatusTab>('todos');
  readonly newOrderAlert = signal<string | null>(null);

  searchText = '';
  dateRange = 'today';
  readonly pageSize = 20;

  private searchTimeout: any;
  private realtimeChannel: any;

  readonly statusTabs = [
    { key: 'todos' as StatusTab, label: 'Todos' },
    { key: 'activos' as StatusTab, label: 'Activos' },
    { key: 'recibido' as StatusTab, label: 'Recibido' },
    { key: 'confirmado' as StatusTab, label: 'Confirmado' },
    { key: 'en_preparacion' as StatusTab, label: 'En preparación' },
    { key: 'en_camino' as StatusTab, label: 'En camino' },
    { key: 'entregado' as StatusTab, label: 'Entregado' },
    { key: 'cancelado' as StatusTab, label: 'Cancelado' },
  ];

  readonly columns: TableColumn[] = [
    { key: 'order_number_display', label: '#', type: 'text' },
    { key: 'restaurant_name', label: 'Restaurante', type: 'text' },
    { key: 'customer_name', label: 'Cliente', type: 'text' },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'delivery_fee', label: 'Delivery', type: 'currency' },
    { key: 'status', label: 'Estado', type: 'badge' },
    { key: 'repartidor_name', label: 'Repartidor', type: 'text' },
    { key: 'created_at', label: 'Hora', type: 'date' },
  ];

  readonly activeOnPage = computed(() =>
    this.orders().filter(o => ['recibido', 'confirmado', 'en_preparacion', 'en_camino'].includes(o.status)).length
  );
  readonly deliveredOnPage = computed(() => this.orders().filter(o => o.status === 'entregado').length);
  readonly cancelledOnPage = computed(() => this.orders().filter(o => o.status === 'cancelado').length);

  ngOnInit(): void {
    this.loadOrders();
    this.subscribeRealtime();
  }

  ngOnDestroy(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
  }

  private getFilters(): OrderFilters {
    const { dateFrom, dateTo } = this.getDateRange();
    return {
      status: this.activeTab() === 'todos' ? null : this.activeTab() as any,
      date_from: dateFrom,
      date_to: dateTo,
      search: this.searchText || null,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };
  }

  private getDateRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (this.dateRange === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      return { dateFrom: d, dateTo: d };
    }
    if (this.dateRange === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      return { dateFrom: w.toISOString().split('T')[0], dateTo: today };
    }
    if (this.dateRange === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: m.toISOString().split('T')[0], dateTo: today };
    }
    return { dateFrom: today, dateTo: today };
  }

  loadOrders(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.ordersService.getOrders(this.getFilters()).subscribe({
      next: ({ data, count }) => {
        this.orders.set(data.map(o => ({ ...o, order_number_display: o.order_number ?? o.id.slice(0, 8).toUpperCase() })));
        this.totalCount.set(count);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los pedidos con los filtros actuales.');
        this.toastService.error('Error al cargar pedidos');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: StatusTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.loadOrders();
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(1);
      this.loadOrders();
    }, 300);
  }

  applyDateFilter(): void {
    this.currentPage.set(1);
    this.loadOrders();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadOrders();
  }

  goToDetail(order: any): void {
    this.router.navigate(['/orders', order.id]);
  }

  private subscribeRealtime(): void {
    this.realtimeChannel = this.ordersService.subscribeToOrders((payload) => {
      if (payload.eventType === 'INSERT') {
        const num = payload.new?.order_number ?? '';
        this.newOrderAlert.set(`Nuevo pedido ${num}`);
        setTimeout(() => this.newOrderAlert.set(null), 5000);
        this.toastService.info(`📦 Nuevo pedido ${num}`);
        this.loadOrders();
      } else if (payload.eventType === 'UPDATE') {
        this.loadOrders();
      }
    });
  }
}
