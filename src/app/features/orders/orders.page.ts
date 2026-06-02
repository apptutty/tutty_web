import {
    Component, OnInit, OnDestroy, inject, signal, computed, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    </app-page-header>

    <!-- Status tabs -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit overflow-x-auto">
      @for (tab of statusTabs; track tab.key) {
        <button
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          [class]="activeTab() === tab.key
            ? 'bg-white text-gray-800 shadow-theme-xs'
            : 'text-gray-500 hover:text-gray-700'"
          (click)="setTab(tab.key)"
        >{{ tab.label }}</button>
      }
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <input
        type="search"
        class="input-field max-w-xs"
        placeholder="Buscar por # pedido..."
        [(ngModel)]="searchText"
        (ngModelChange)="onSearchChange()"
      />
      <select class="input-field w-40" [(ngModel)]="dateRange" (ngModelChange)="applyDateFilter()">
        <option value="today">Hoy</option>
        <option value="yesterday">Ayer</option>
        <option value="week">Esta semana</option>
        <option value="month">Este mes</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
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
        { key: 'order_number', label: '#', type: 'text' },
        { key: 'restaurant_name', label: 'Restaurante', type: 'text' },
        { key: 'customer_name', label: 'Cliente', type: 'text' },
        { key: 'items_count', label: 'Items', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'delivery_fee', label: 'Delivery', type: 'currency' },
        { key: 'status', label: 'Estado', type: 'badge' },
        { key: 'repartidor_name', label: 'Repartidor', type: 'text' },
        { key: 'created_at', label: 'Hora', type: 'date' },
    ];

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
        this.ordersService.getOrders(this.getFilters()).subscribe({
            next: ({ data, count }) => {
                this.orders.set(data.map(o => ({ ...o, items_count: o.items?.length ?? '—' })));
                this.totalCount.set(count);
                this.loading.set(false);
            },
            error: () => {
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
