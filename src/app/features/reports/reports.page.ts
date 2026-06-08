import { Component, inject, signal, computed, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, SalesByDay, RestaurantSales, TopProduct, CourierPerformance, CommerceTypeRow, CustomerRetention, TopCustomer, PromoEffectiveness, SurchargeDay, SurchargeTotals } from './reports.service';
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
      <div class="card p-4 mb-6">
        <!-- Quick presets -->
        <div class="flex flex-wrap gap-2 mb-4">
          @for (preset of presets; track preset.label) {
            <button class="px-3 py-1.5 text-sm rounded-full border border-gray-300 hover:border-brand-500 hover:text-brand-500 transition-colors" (click)="applyPreset(preset)">
              {{ preset.label }}
            </button>
          }
        </div>
        <!-- Date inputs -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div class="flex-1 w-full">
            <label class="label">Desde</label>
            <input type="date" class="input-field w-full" [(ngModel)]="fromDate" />
          </div>
          <span class="hidden sm:block text-gray-300 mb-2.5">→</span>
          <div class="flex-1 w-full">
            <label class="label">Hasta</label>
            <input type="date" class="input-field w-full" [(ngModel)]="toDate" />
          </div>
          <button class="btn-primary w-full sm:w-auto" (click)="loadAll()" [disabled]="loading()">
            {{ loading() ? 'Cargando...' : 'Aplicar' }}
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <app-stat-card title="Ingresos Totales" [value]="totalRevenue() | currencyDop" icon="💰" color="green" />
        <app-stat-card title="Pedidos Entregados" [value]="totalOrders()" icon="📦" color="blue" />
        <app-stat-card title="Ticket Promedio" [value]="avgTicket() | currencyDop" icon="🧾" color="purple" />
        <app-stat-card title="Tasa de Cancelación" [value]="cancellationRate()" icon="❌" color="red" />
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
        @if (loadingCouriers()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded"></div>
        } @else if (courierPerformance().length === 0) {
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
                @for (r of courierPerformance(); track r.full_name) {
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

      <!-- extra tab bar (always visible below main content) -->
      <div class="mt-8">
        <div class="flex gap-0 border-b border-gray-200 mb-5 overflow-x-auto">
          @for (t of extraTabs; track t.id) {
            <button (click)="activeExtraTab.set(t.id)"
              class="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
              [class]="activeExtraTab() === t.id ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-500 hover:text-gray-700'">
              {{ t.label }}
            </button>
          }
        </div>

        <!-- Tab: Multi-Comercio -->
        @if (activeExtraTab() === 'multicomercio') {
          @if (loadingCommerceTypes()) {
            <div class="animate-pulse h-40 bg-gray-100 rounded-xl"></div>
          } @else {
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-5">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo de Comercio</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comercios activos</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Pedidos</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventas</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ticket prom.</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-100">
                    @if (commerceTypeRows().length === 0) {
                      <tr><td colspan="6" class="px-4 py-10 text-center text-gray-400">Sin datos para el período</td></tr>
                    }
                    @for (row of commerceTypeRows(); track row.commerce_type) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 font-medium text-gray-800 capitalize">{{ row.commerce_type.replace('_', ' ') }}</td>
                        <td class="px-4 py-3 text-right text-gray-600">{{ row.active_stores }}</td>
                        <td class="px-4 py-3 text-right text-gray-700">{{ row.orders }}</td>
                        <td class="px-4 py-3 text-right font-semibold text-gray-900">{{ row.revenue | currencyDop }}</td>
                        <td class="px-4 py-3 text-right text-brand-500">{{ row.commission | currencyDop }}</td>
                        <td class="px-4 py-3 text-right text-gray-600">{{ row.avg_ticket | currencyDop }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <!-- Donut chart: distribución de ventas -->
            @if (commerceTypeRows().length > 0) {
              <div class="bg-white rounded-xl border border-gray-200 p-5">
                <h4 class="font-semibold text-gray-800 mb-4 text-sm">Distribución de ventas por tipo de comercio</h4>
                <div class="flex flex-wrap gap-3 items-center">
                  <div class="relative" style="width:180px;height:180px">
                    <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
                      @for (slice of donutSlices(); track slice.type; let i = $index) {
                        <circle cx="18" cy="18" r="15.9154943"
                          fill="none"
                          [attr.stroke]="donutColors[i % donutColors.length]"
                          stroke-width="4"
                          [attr.stroke-dasharray]="slice.dash"
                          [attr.stroke-dashoffset]="slice.offset"
                        />
                      }
                    </svg>
                  </div>
                  <div class="flex flex-col gap-2">
                    @for (slice of donutSlices(); track slice.type; let i = $index) {
                      <div class="flex items-center gap-2 text-sm">
                        <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background-color]="donutColors[i % donutColors.length]"></span>
                        <span class="text-gray-700 capitalize">{{ slice.type.replace('_',' ') }}</span>
                        <span class="text-gray-400 text-xs">({{ slice.pct }}%)</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          }
        }

        <!-- Tab: Retención de Clientes -->
        @if (activeExtraTab() === 'retencion') {
          @if (loadingRetention()) {
            <div class="animate-pulse h-40 bg-gray-100 rounded-xl"></div>
          } @else if (retentionData()) {
            <!-- KPI cards -->
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
              <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400">Nuevos</p>
                <p class="text-2xl font-bold text-gray-800">{{ retentionData()!.summary.new_customers }}</p>
              </div>
              <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400">Recurrentes</p>
                <p class="text-2xl font-bold text-brand-500">{{ retentionData()!.summary.returning_customers }}</p>
              </div>
              <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400">Total únicos</p>
                <p class="text-2xl font-bold text-gray-800">{{ retentionData()!.summary.total_customers }}</p>
              </div>
              <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400">Tasa repetición</p>
                <p class="text-2xl font-bold text-success-600">{{ retentionData()!.summary.repeat_rate }}%</p>
              </div>
              <div class="bg-white rounded-xl border border-brand-200 p-4 bg-brand-50">
                <p class="text-xs text-brand-400">LTV estimado</p>
                <p class="text-2xl font-bold text-brand-600">{{ retentionData()!.summary.ltv | currencyDop }}</p>
              </div>
            </div>

            <!-- Top 20 clients -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">Top 20 clientes por pedidos</div>
                <div class="overflow-x-auto">
                  <table class="min-w-full text-sm divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-2 text-left text-xs text-gray-500 uppercase">#</th>
                        <th class="px-4 py-2 text-left text-xs text-gray-500 uppercase">Cliente</th>
                        <th class="px-4 py-2 text-right text-xs text-gray-500 uppercase">Pedidos</th>
                        <th class="px-4 py-2 text-right text-xs text-gray-500 uppercase">Total gastado</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (c of retentionData()!.topCustomers; track c.user_id; let i = $index) {
                        <tr class="hover:bg-gray-50">
                          <td class="px-4 py-2 text-gray-400">{{ i + 1 }}</td>
                          <td class="px-4 py-2 font-medium text-gray-800">{{ c.name }}</td>
                          <td class="px-4 py-2 text-right text-brand-500 font-semibold">{{ c.order_count }}</td>
                          <td class="px-4 py-2 text-right text-gray-700">{{ c.total_spent | currencyDop }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
              <!-- Inactive customers -->
              <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm flex items-center gap-2">
                  Inactivos &gt;30 días
                  <span class="bg-error-100 text-error-600 text-xs px-2 py-0.5 rounded-full">Campaña de reactivación</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full text-sm divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-2 text-left text-xs text-gray-500 uppercase">Cliente</th>
                        <th class="px-4 py-2 text-right text-xs text-gray-500 uppercase">Último pedido</th>
                        <th class="px-4 py-2 text-right text-xs text-gray-500 uppercase">Pedidos total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @if (retentionData()!.inactive.length === 0) {
                        <tr><td colspan="3" class="px-4 py-8 text-center text-gray-400">Sin clientes inactivos 🎉</td></tr>
                      }
                      @for (c of retentionData()!.inactive; track c.user_id) {
                        <tr class="hover:bg-gray-50">
                          <td class="px-4 py-2 font-medium text-gray-800">{{ c.name }}</td>
                          <td class="px-4 py-2 text-right text-gray-500 text-xs">{{ c.last_order | date:'dd/MM/yyyy' }}</td>
                          <td class="px-4 py-2 text-right text-gray-600">{{ c.order_count }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }
        }

        <!-- Tab: Efectividad de Promociones -->
        @if (activeExtraTab() === 'promociones') {
          @if (loadingPromos()) {
            <div class="animate-pulse h-40 bg-gray-100 rounded-xl"></div>
          } @else if (promoRows().length === 0) {
            <div class="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              Sin datos de promociones para el período
            </div>
          } @else {
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Promoción</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Usos</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Descuento total</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventas generadas</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ROI</th>
                      <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">¿Vale la pena?</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-100">
                    @for (p of promoRows(); track p.promo_id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 font-medium text-gray-800">{{ p.promo_name }}</td>
                        <td class="px-4 py-3 text-right text-gray-600">{{ p.uses }}</td>
                        <td class="px-4 py-3 text-right text-error-500">{{ p.discount_total | currencyDop }}</td>
                        <td class="px-4 py-3 text-right text-success-600 font-semibold">{{ p.revenue_generated | currencyDop }}</td>
                        <td class="px-4 py-3 text-right font-bold" [class]="p.roi >= 3 ? 'text-success-600' : 'text-error-500'">
                          {{ p.roi }}x
                        </td>
                        <td class="px-4 py-3 text-center">
                          @if (p.roi >= 3) {
                            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-700">✓ Rentable</span>
                          } @else {
                            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-error-100 text-error-600">✗ Revisar</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        }

        <!-- Tab: Surcharges -->
        @if (activeExtraTab() === 'surcharges') {
          @if (loadingSurcharge()) {
            <div class="animate-pulse h-40 bg-gray-100 rounded-xl"></div>
          } @else {
            <!-- Summary cards -->
            @if (surchargeTotals()) {
              <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <div class="bg-white rounded-xl border border-gray-200 p-4">
                  <p class="text-xl mb-1">🌧</p>
                  <p class="text-xs text-gray-400">Clima</p>
                  <p class="font-bold text-gray-800 text-lg">{{ surchargeTotals()!.weather | currencyDop }}</p>
                </div>
                <div class="bg-white rounded-xl border border-gray-200 p-4">
                  <p class="text-xl mb-1">🕐</p>
                  <p class="text-xs text-gray-400">Hora pico</p>
                  <p class="font-bold text-gray-800 text-lg">{{ surchargeTotals()!.peak | currencyDop }}</p>
                </div>
                <div class="bg-white rounded-xl border border-gray-200 p-4">
                  <p class="text-xl mb-1">🌙</p>
                  <p class="text-xs text-gray-400">Nocturno</p>
                  <p class="font-bold text-gray-800 text-lg">{{ surchargeTotals()!.night | currencyDop }}</p>
                </div>
                <div class="bg-white rounded-xl border border-gray-200 p-4">
                  <p class="text-xl mb-1">🎉</p>
                  <p class="text-xs text-gray-400">Feriado</p>
                  <p class="font-bold text-gray-800 text-lg">{{ surchargeTotals()!.holiday | currencyDop }}</p>
                </div>
                <div class="bg-white rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <p class="text-xl mb-1">💰</p>
                  <p class="text-xs text-brand-400">Total recargos</p>
                  <p class="font-bold text-brand-600 text-lg">{{ surchargeTotals()!.total | currencyDop }}</p>
                </div>
              </div>
            }

            <!-- Daily breakdown table -->
            @if (surchargeDaily().length === 0) {
              <div class="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
                Sin datos de recargos para el período
              </div>
            } @else {
              <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">🌧 Clima</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">🕐 Pico</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">🌙 Nocturno</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">🎉 Feriado</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Eventos</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-100">
                      @for (day of surchargeDaily(); track day.date) {
                        <tr class="hover:bg-gray-50" [class]="day.weather_extra > 0 ? 'bg-blue-50/30' : ''">
                          <td class="px-4 py-3 font-medium text-gray-800">{{ day.date | date:'dd/MM/yyyy' }}</td>
                          <td class="px-4 py-3 text-right" [class]="day.weather_extra > 0 ? 'text-blue-500 font-medium' : 'text-gray-300'">
                            {{ day.weather_extra > 0 ? (day.weather_extra | currencyDop) : '—' }}
                          </td>
                          <td class="px-4 py-3 text-right" [class]="day.peak_extra > 0 ? 'text-orange-500 font-medium' : 'text-gray-300'">
                            {{ day.peak_extra > 0 ? (day.peak_extra | currencyDop) : '—' }}
                          </td>
                          <td class="px-4 py-3 text-right" [class]="day.night_extra > 0 ? 'text-indigo-500 font-medium' : 'text-gray-300'">
                            {{ day.night_extra > 0 ? (day.night_extra | currencyDop) : '—' }}
                          </td>
                          <td class="px-4 py-3 text-right" [class]="day.holiday_extra > 0 ? 'text-yellow-600 font-medium' : 'text-gray-300'">
                            {{ day.holiday_extra > 0 ? (day.holiday_extra | currencyDop) : '—' }}
                          </td>
                          <td class="px-4 py-3 text-right font-bold text-brand-500">{{ day.total_surcharge | currencyDop }}</td>
                          <td class="px-4 py-3 text-right text-gray-400">{{ day.count }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }
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
  loadingCouriers = signal(false);

  // SA-7.1 signals
  activeExtraTab = signal<'multicomercio' | 'retencion' | 'promociones' | 'surcharges'>('multicomercio');
  extraTabs = [
    { id: 'multicomercio' as const, label: 'Multi-Comercio' },
    { id: 'retencion' as const, label: 'Retención de Clientes' },
    { id: 'promociones' as const, label: 'Efectividad de Promociones' },
    { id: 'surcharges' as const, label: 'Surcharges' },
  ];

  commerceTypeRows = signal<CommerceTypeRow[]>([]);
  loadingCommerceTypes = signal(false);

  retentionData = signal<{ summary: CustomerRetention; topCustomers: TopCustomer[]; inactive: TopCustomer[] } | null>(null);
  loadingRetention = signal(false);

  promoRows = signal<PromoEffectiveness[]>([]);
  loadingPromos = signal(false);

  surchargeDaily = signal<SurchargeDay[]>([]);
  surchargeTotals = signal<SurchargeTotals | null>(null);
  loadingSurcharge = signal(false);

  readonly donutColors = ['#FF3C97', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#06B6D4', '#84CC16'];

  donutSlices = computed(() => {
    const rows = this.commerceTypeRows();
    const total = rows.reduce((s, r) => s + r.revenue, 0);
    if (total === 0) return [];
    const circumference = 100;
    let offset = 0;
    return rows.map(r => {
      const pct = Math.round((r.revenue / total) * 100);
      const dash = (r.revenue / total) * circumference;
      const slice = { type: r.commerce_type, pct, dash: `${dash} ${circumference - dash}`, offset: -offset };
      offset += dash;
      return slice;
    });
  });

  salesByDay = signal<SalesByDay[]>([]);
  restaurantSales = signal<RestaurantSales[]>([]);
  topProducts = signal<TopProduct[]>([]);
  courierPerformance = signal<CourierPerformance[]>([]);
  cancellationData = signal<{ total: number; cancelled: number; rate: number } | null>(null);

  totalRevenue = computed(() => this.salesByDay().reduce((s, d) => s + d.total, 0));
  totalOrders = computed(() => this.salesByDay().reduce((s, d) => s + d.orders, 0));
  avgTicket = computed(() => this.totalOrders() > 0 ? this.totalRevenue() / this.totalOrders() : 0);
  cancellationRate = computed(() => {
    const d = this.cancellationData();
    if (d == null || isNaN(d.rate)) return '0%';
    return `${d.rate.toFixed(1)}%`;
  });

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
    this.loadingCouriers.set(true);

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
    this.reportsService.courierPerformance(this.fromDate, this.toDate).subscribe({
      next: (d) => { this.courierPerformance.set(d); this.loadingCouriers.set(false); },
      error: () => this.loadingCouriers.set(false)
    });
    this.reportsService.cancellationRate(this.fromDate, this.toDate).subscribe({
      next: (d) => { this.cancellationData.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });

    // SA-7.1 extra tabs
    this.loadCommerceTypes();
    this.loadRetention();
    this.loadPromos();
    this.loadSurcharges();
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

  // SA-7.1 loaders
  private loadCommerceTypes() {
    this.loadingCommerceTypes.set(true);
    this.reportsService.commerceTypeComparison(this.fromDate, this.toDate + 'T23:59:59').subscribe({
      next: (d) => { this.commerceTypeRows.set(d); this.loadingCommerceTypes.set(false); },
      error: () => this.loadingCommerceTypes.set(false),
    });
  }

  private loadRetention() {
    this.loadingRetention.set(true);
    this.reportsService.customerRetention(this.fromDate, this.toDate + 'T23:59:59').subscribe({
      next: (d) => { this.retentionData.set(d); this.loadingRetention.set(false); },
      error: () => this.loadingRetention.set(false),
    });
  }

  private loadPromos() {
    this.loadingPromos.set(true);
    this.reportsService.promoEffectiveness(this.fromDate, this.toDate + 'T23:59:59').subscribe({
      next: (d) => { this.promoRows.set(d); this.loadingPromos.set(false); },
      error: () => this.loadingPromos.set(false),
    });
  }

  private loadSurcharges() {
    this.loadingSurcharge.set(true);
    this.reportsService.surchargeReport(this.fromDate, this.toDate + 'T23:59:59').subscribe({
      next: (d) => { this.surchargeDaily.set(d.daily); this.surchargeTotals.set(d.totals); this.loadingSurcharge.set(false); },
      error: () => this.loadingSurcharge.set(false),
    });
  }
}
