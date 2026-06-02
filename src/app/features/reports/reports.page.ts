import { Component, inject, signal, computed, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, SalesByDay, RestaurantSales, TopProduct, RepartidorPerformance } from './reports.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { CurrencyDopPipe } from '../../shared/pipes/currency-dop.pipe';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
    selector: 'app-reports-page',
    standalone: true,
    imports: [CommonModule, FormsModule, PageHeaderComponent, CurrencyDopPipe, StatCardComponent],
    template: `
    <div class="p-6">
      <app-page-header title="Reportes y Analítica" subtitle="Análisis de rendimiento de la plataforma">
        <button class="btn-secondary text-sm" (click)="exportCSV()">⬇ Exportar CSV</button>
      </app-page-header>

      <!-- Date Range Picker -->
      <div class="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label class="label">Desde</label>
          <input type="date" class="input-field" [(ngModel)]="fromDate" />
        </div>
        <div>
          <label class="label">Hasta</label>
          <input type="date" class="input-field" [(ngModel)]="toDate" />
        </div>
        <div class="flex gap-2">
          @for (preset of presets; track preset.label) {
            <button class="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700" (click)="applyPreset(preset)">
              {{ preset.label }}
            </button>
          }
        </div>
        <button class="btn-primary" (click)="loadAll()" [disabled]="loading()">
          {{ loading() ? 'Cargando...' : 'Aplicar' }}
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <app-stat-card title="Ingresos Totales" [value]="totalRevenue() | currencyDop" icon="💰" color="green" />
        <app-stat-card title="Pedidos Entregados" [value]="totalOrders()" icon="📦" color="blue" />
        <app-stat-card title="Ticket Promedio" [value]="avgTicket() | currencyDop" icon="🧾" color="purple" />
        <app-stat-card title="Tasa de Cancelación" [value]="cancellationData()?.rate + '%'" icon="❌" color="red" />
      </div>

      <!-- Sales Chart -->
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Ventas por Día</h3>
        @if (loadingChart()) {
          <div class="animate-pulse h-64 bg-gray-200 rounded"></div>
        } @else if (salesByDay().length === 0) {
          <p class="text-center text-gray-500 py-16">No hay datos para el período seleccionado</p>
        } @else {
          <div class="relative h-72">
            <canvas #salesChart></canvas>
          </div>
        }
      </div>

      <!-- Two columns: restaurants + products -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        <!-- Top Restaurants -->
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Ventas por Restaurante</h3>
          @if (loadingRestaurants()) {
            <div class="space-y-2">@for (i of [1,2,3]; track i) { <div class="animate-pulse h-12 bg-gray-200 rounded"></div> }</div>
          } @else if (restaurantSales().length === 0) {
            <p class="text-center text-gray-500 py-8">Sin datos</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500 text-xs uppercase">
                    <th class="pb-2">Restaurante</th>
                    <th class="pb-2 text-right">Pedidos</th>
                    <th class="pb-2 text-right">Ingresos</th>
                    <th class="pb-2 text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (r of restaurantSales().slice(0, 10); track r.restaurant_name) {
                    <tr>
                      <td class="py-2 font-medium text-gray-900">{{ r.restaurant_name }}</td>
                      <td class="py-2 text-right text-gray-600">{{ r.orders }}</td>
                      <td class="py-2 text-right text-gray-900">{{ r.revenue | currencyDop }}</td>
                      <td class="py-2 text-right text-success-600">{{ r.commission | currencyDop }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Top Products -->
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Productos Más Vendidos</h3>
          @if (loadingProducts()) {
            <div class="space-y-2">@for (i of [1,2,3]; track i) { <div class="animate-pulse h-12 bg-gray-200 rounded"></div> }</div>
          } @else if (topProducts().length === 0) {
            <p class="text-center text-gray-500 py-8">Sin datos</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500 text-xs uppercase">
                    <th class="pb-2">Producto</th>
                    <th class="pb-2">Restaurante</th>
                    <th class="pb-2 text-right">Unidades</th>
                    <th class="pb-2 text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (p of topProducts().slice(0, 10); track p.product_name) {
                    <tr>
                      <td class="py-2 font-medium text-gray-900">{{ p.product_name }}</td>
                      <td class="py-2 text-gray-500 text-xs">{{ p.restaurant_name }}</td>
                      <td class="py-2 text-right text-gray-600">{{ p.quantity }}</td>
                      <td class="py-2 text-right text-gray-900">{{ p.revenue | currencyDop }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- Repartidor Performance -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Rendimiento de Repartidores</h3>
        @if (loadingRepartidores()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded"></div>
        } @else if (repartidorPerformance().length === 0) {
          <p class="text-center text-gray-500 py-8">Sin datos</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500 text-xs uppercase bg-gray-50">
                  <th class="px-4 py-3">Repartidor</th>
                  <th class="px-4 py-3 text-right">Entregas</th>
                  <th class="px-4 py-3 text-right">Tiempo Prom.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (r of repartidorPerformance(); track r.full_name) {
                  <tr>
                    <td class="px-4 py-3 font-medium text-gray-900">{{ r.full_name }}</td>
                    <td class="px-4 py-3 text-right text-gray-600">{{ r.deliveries }}</td>
                    <td class="px-4 py-3 text-right text-gray-600">{{ r.avg_time_minutes }} min</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `
})
export class ReportsPageComponent implements OnInit, AfterViewInit {
    @ViewChild('salesChart') salesChartRef!: ElementRef<HTMLCanvasElement>;
    private reportsService = inject(ReportsService);

    loading = signal(false);
    loadingChart = signal(false);
    loadingRestaurants = signal(false);
    loadingProducts = signal(false);
    loadingRepartidores = signal(false);

    salesByDay = signal<SalesByDay[]>([]);
    restaurantSales = signal<RestaurantSales[]>([]);
    topProducts = signal<TopProduct[]>([]);
    repartidorPerformance = signal<RepartidorPerformance[]>([]);
    cancellationData = signal<{ total: number; cancelled: number; rate: number } | null>(null);

    totalRevenue = computed(() => this.salesByDay().reduce((s, d) => s + d.total, 0));
    totalOrders = computed(() => this.salesByDay().reduce((s, d) => s + d.orders, 0));
    avgTicket = computed(() => this.totalOrders() > 0 ? this.totalRevenue() / this.totalOrders() : 0);

    fromDate = '';
    toDate = '';
    private chart: Chart | null = null;

    presets = [
        { label: 'Hoy', days: 0 },
        { label: '7 días', days: 7 },
        { label: '30 días', days: 30 },
        { label: '90 días', days: 90 },
    ];

    ngOnInit() {
        this.applyPreset({ days: 30 });
    }

    ngAfterViewInit() {
        // chart renders after data loads
    }

    applyPreset(preset: { days: number }) {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - preset.days);
        this.toDate = to.toISOString().slice(0, 10);
        this.fromDate = from.toISOString().slice(0, 10);
        this.loadAll();
    }

    loadAll() {
        if (!this.fromDate || !this.toDate) return;
        this.loading.set(true);
        this.loadingChart.set(true);
        this.loadingRestaurants.set(true);
        this.loadingProducts.set(true);
        this.loadingRepartidores.set(true);

        this.reportsService.salesByDay(this.fromDate, this.toDate).subscribe({
            next: (d) => { this.salesByDay.set(d); this.loadingChart.set(false); this.renderChart(d); },
            error: () => this.loadingChart.set(false)
        });
        this.reportsService.ordersByRestaurant(this.fromDate, this.toDate).subscribe({
            next: (d) => { this.restaurantSales.set(d); this.loadingRestaurants.set(false); },
            error: () => this.loadingRestaurants.set(false)
        });
        this.reportsService.topProducts(this.fromDate, this.toDate).subscribe({
            next: (d) => { this.topProducts.set(d); this.loadingProducts.set(false); },
            error: () => this.loadingProducts.set(false)
        });
        this.reportsService.repartidorPerformance(this.fromDate, this.toDate).subscribe({
            next: (d) => { this.repartidorPerformance.set(d); this.loadingRepartidores.set(false); },
            error: () => this.loadingRepartidores.set(false)
        });
        this.reportsService.cancellationRate(this.fromDate, this.toDate).subscribe({
            next: (d) => { this.cancellationData.set(d); this.loading.set(false); },
            error: () => this.loading.set(false)
        });
    }

    private renderChart(data: SalesByDay[]) {
        if (!this.salesChartRef?.nativeElement) {
            setTimeout(() => this.renderChart(data), 100);
            return;
        }
        if (this.chart) { this.chart.destroy(); this.chart = null; }
        const ctx = this.salesChartRef.nativeElement.getContext('2d');
        if (!ctx) return;
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Ingresos (RD$)',
                    data: data.map(d => d.total),
                    backgroundColor: 'rgba(229, 57, 53, 0.7)',
                    borderColor: '#E53935',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: (v) => 'RD$ ' + Number(v).toLocaleString() } }
                }
            }
        });
    }

    exportCSV() {
        const rows = this.salesByDay();
        if (rows.length === 0) return;
        const header = 'Fecha,Pedidos,Ingresos\n';
        const body = rows.map(r => `${r.date},${r.orders},${r.total}`).join('\n');
        const blob = new Blob([header + body], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reportes_tutty_${this.fromDate}_${this.toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
