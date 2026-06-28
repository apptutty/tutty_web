import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from './dashboard.service';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { DataTableComponent, TableColumn } from '../../shared/ui/data-table/data-table.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { CurrencyDopPipe } from '../../shared/pipes/currency-dop.pipe';
import { ApprovalQueueService } from '../approvals/approval-queue.service';
import { DashboardKPIs, Order, StatusCount, StoreApproval } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

const STATUS_ORDER = ['recibido', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'];

@Component({
    selector: 'app-dashboard-page',
    standalone: true,
    imports: [
        CommonModule, RouterLink, StatCardComponent, DataTableComponent,
        StatusBadgeComponent, PageHeaderComponent, CurrencyDopPipe, AdminEmptyStateComponent,
    ],
    template: `
    <app-page-header title="Dashboard" subtitle="Resumen en tiempo real de la plataforma" />

    <!-- KPI Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <app-stat-card
        title="Ventas Hoy"
        [value]="kpis()?.ventas_hoy | currencyDop"
        icon="💰"
        color="green"
        trend="up"
        subtitle="pedidos completados"
      />
      <app-stat-card
        title="Pedidos Hoy"
        [value]="kpis()?.pedidos_hoy ?? 0"
        icon="📦"
        color="blue"
        trend="neutral"
        subtitle="desde medianoche"
      />
      <app-stat-card
        title="Pedidos Activos"
        [value]="kpis()?.pedidos_activos ?? 0"
        icon="⚡"
        color="yellow"
        trend="neutral"
        [pulse]="(kpis()?.pedidos_activos ?? 0) > 0"
        subtitle="en este momento"
      />
      <app-stat-card
        title="Restaurantes Abiertos"
        [value]="kpis()?.active_commerces ?? 0"
        icon="🏪"
        color="purple"
        trend="neutral"
        subtitle="en línea ahora"
      />
    </div>

    <!-- Main grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Recent orders table -->
      <div class="lg:col-span-2 admin-table-card">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="text-sm font-semibold text-gray-800">Pedidos Recientes</h2>
          <a href="/orders" class="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors">Ver todos →</a>
        </div>
        <app-data-table
          [columns]="orderColumns"
          [data]="recentOrders()"
          [loading]="ordersLoading()"
          [sortable]="false"
        />
      </div>

      <!-- Right column -->
      <div class="space-y-4">
        <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm p-5">
          <h2 class="text-sm font-semibold text-gray-800 mb-4">Pedidos por Estado</h2>
          <div class="space-y-3.5">
            @for (item of sortedStatuses(); track item.status) {
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <app-status-badge [status]="item.status" />
                  <span class="text-xs font-semibold text-gray-700">{{ item.count }}</span>
                </div>
                <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [class]="progressColor(item.status)"
                    [style.width.%]="progressWidth(item.count)"
                  ></div>
                </div>
              </div>
            }
            @if (sortedStatuses().length === 0) {
              <app-admin-empty-state
                icon="orders"
                title="Sin datos de estados"
                description="Cuando entren pedidos en la plataforma, verás su distribución aquí."
                variant="soft" />
            }
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-800">Aprobaciones pendientes</h2>
            <a routerLink="/approvals" class="text-xs text-brand-500 hover:text-brand-600 font-medium">Gestionar →</a>
          </div>
          @if (pendingApprovalsLoading()) {
            <div class="space-y-2">
              @for (i of [1,2,3]; track i) {
                <div class="h-10 bg-gray-100 rounded animate-pulse"></div>
              }
            </div>
          } @else if (pendingApprovals().length === 0) {
            <app-admin-empty-state
              icon="users"
              title="Sin aprobaciones pendientes"
              description="Todo está al día en este momento."
              variant="soft" />
          } @else {
            <div class="space-y-2">
              @for (store of pendingApprovals().slice(0, 4); track store.id) {
                <div class="rounded-lg border border-gray-100 px-3 py-2">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ store.name }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ store.city || '—' }} · {{ store.commerce_type || 'comercio' }}</p>
                </div>
              }
            </div>
          }
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm p-5">
          <h2 class="text-sm font-semibold text-gray-800 mb-4">Acciones rápidas</h2>
          <div class="grid grid-cols-2 gap-2">
            <a routerLink="/orders" class="admin-btn admin-btn--secondary text-xs justify-start">Ver pedidos</a>
            <a routerLink="/stores" class="admin-btn admin-btn--secondary text-xs justify-start">Gestionar comercios</a>
            <a routerLink="/support" class="admin-btn admin-btn--secondary text-xs justify-start">Abrir soporte</a>
            <a routerLink="/reports" class="admin-btn admin-btn--secondary text-xs justify-start">Ir a reportes</a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardPageComponent implements OnInit {
    private readonly dashboardService = inject(DashboardService);
    private readonly approvalService = inject(ApprovalQueueService);

    readonly kpis = signal<DashboardKPIs | null>(null);
    readonly recentOrders = signal<any[]>([]);
    readonly statusCounts = signal<StatusCount[]>([]);
    readonly pendingApprovals = signal<StoreApproval[]>([]);
    readonly pendingApprovalsLoading = signal(true);
    readonly ordersLoading = signal(true);
    readonly kpisLoading = signal(true);

    readonly orderColumns: TableColumn[] = [
        { key: 'order_number', label: '#', type: 'text' },
        { key: 'restaurant_name', label: 'Restaurante', type: 'text' },
        { key: 'customer_name', label: 'Cliente', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'status', label: 'Estado', type: 'badge' },
        { key: 'created_at', label: 'Hace', type: 'date' },
    ];

    ngOnInit(): void {
        this.loadKPIs();
        this.loadOrders();
        this.loadStatusCounts();
        this.loadPendingApprovals();
    }

    private loadKPIs(): void {
        this.dashboardService.getKPIsOnce().subscribe(data => {
            this.kpis.set(data);
            this.kpisLoading.set(false);
        });
    }

    private loadOrders(): void {
        this.dashboardService.getRecentOrders(10).subscribe(orders => {
            const mapped = orders.map((o: any) => ({
                ...o,
                restaurant_name: o.restaurant?.name ?? '—',
                customer_name: o.customer?.full_name ?? '—',
            }));
            this.recentOrders.set(mapped);
            this.ordersLoading.set(false);
        });
    }

    private loadStatusCounts(): void {
        this.dashboardService.getOrdersByStatus().subscribe(counts => {
            this.statusCounts.set(counts);
        });
    }

    private loadPendingApprovals(): void {
        this.pendingApprovalsLoading.set(true);
        this.approvalService.getStoresByStatus('pendiente').subscribe({
            next: rows => {
                this.pendingApprovals.set(rows);
                this.pendingApprovalsLoading.set(false);
            },
            error: () => this.pendingApprovalsLoading.set(false),
        });
    }

    readonly sortedStatuses = () => {
        const counts = this.statusCounts();
        return STATUS_ORDER
            .map(s => counts.find(c => c.status === s) ?? { status: s, count: 0 })
            .filter(c => c.count > 0);
    };

    progressWidth(count: number): number {
        const max = Math.max(...this.statusCounts().map(s => s.count), 1);
        return Math.round((count / max) * 100);
    }

    progressColor(status: string): string {
        const map: Record<string, string> = {
            recibido: 'bg-warning-400',
            confirmado: 'bg-brand-500',
            en_preparacion: 'bg-orange-400',
            en_camino: 'bg-purple-500',
            entregado: 'bg-success-500',
            cancelado: 'bg-error-500',
        };
        return map[status] ?? 'bg-gray-300';
    }
}
