import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayoutsService } from './payouts.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import {
  FinanceKpi, FinanceDailyPoint, PayoutSummary,
  SurchargeStats, DeliveryFeeRange, PayoutMethod,
} from '../../core/supabase/database.types';

type FinanceTab = 'summary' | 'payouts' | 'commissions' | 'delivery' | 'refunds';
type PeriodPreset = 'today' | 'week' | 'month';

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

function periodRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: isoDate(start), to: today };
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(start), to: today };
}

function payoutPeriodRange(preset: 'week' | 'month'): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: isoDate(start), to: today };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(start), to: today };
}

@Component({
  selector: 'app-finances-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, PageHeaderComponent],
  template: `
    <app-page-header title="Finanzas" subtitle="Liquidaciones, comisiones y reportes financieros" />

    <!-- Tabs -->
    <div class="flex gap-0 border-b border-gray-200 mb-5 overflow-x-auto">
      @for (tab of tabs; track tab.id) {
        <button
          (click)="activeTab.set(tab.id)"
          class="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
          [class]="activeTab() === tab.id
            ? 'border-brand-500 text-brand-500'
            : 'border-transparent text-gray-500 hover:text-gray-700'"
        >{{ tab.label }}</button>
      }
    </div>

    <!-- ═══════════════════════════════════════════════════ TAB: RESUMEN -->
    @if (activeTab() === 'summary') {
      <!-- Period selector -->
      <div class="flex flex-wrap items-center gap-2 mb-5">
        @for (p of periodPresets; track p.value) {
          <button
            (click)="setSummaryPeriod(p.value)"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            [class]="summaryPeriod() === p.value
              ? 'bg-brand-500 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'"
          >{{ p.label }}</button>
        }
        <div class="flex items-center gap-2 ml-auto">
          <input type="date" class="input-field w-40 text-sm" [(ngModel)]="summaryFrom" />
          <span class="text-gray-400">—</span>
          <input type="date" class="input-field w-40 text-sm" [(ngModel)]="summaryTo" />
          <button class="btn-primary text-sm" (click)="loadSummaryKpi()">Ver</button>
        </div>
      </div>

      <!-- KPIs -->
      @if (kpiLoading()) {
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div class="h-7 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          }
        </div>
      } @else if (kpi()) {
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-400 mb-1">Ventas brutas</p>
            <p class="text-xl font-bold text-gray-800">RD$ {{ kpi()!.grossSales | number:'1.0-0' }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ kpi()!.orderCount }} pedidos</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-400 mb-1">Comisiones</p>
            <p class="text-xl font-bold text-brand-500">RD$ {{ kpi()!.commissions | number:'1.0-0' }}</p>
            <p class="text-xs text-gray-400 mt-1">
              {{ kpi()!.grossSales > 0 ? ((kpi()!.commissions / kpi()!.grossSales) * 100 | number:'1.1-1') : 0 }}% de ventas
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-400 mb-1">Delivery fees</p>
            <p class="text-xl font-bold text-gray-800">RD$ {{ kpi()!.deliveryFees | number:'1.0-0' }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-400 mb-1">Descuentos otorgados</p>
            <p class="text-xl font-bold text-error-500">-RD$ {{ kpi()!.discounts | number:'1.0-0' }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-brand-50 to-white border-brand-200">
            <p class="text-xs text-brand-400 mb-1">Ingresos netos Tutty</p>
            <p class="text-xl font-bold text-brand-600">RD$ {{ kpi()!.netTutty | number:'1.0-0' }}</p>
            <p class="text-xs text-brand-300 mt-1">comisión + delivery − descuentos</p>
          </div>
        </div>
      }

      <!-- Dual chart: Ventas vs Comisiones por día -->
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="font-semibold text-gray-800 mb-4 text-sm">Ventas vs Comisiones por día</h3>
        @if (chartLoading()) {
          <div class="h-40 animate-pulse bg-gray-100 rounded-lg"></div>
        } @else if (chartData().length === 0) {
          <div class="h-32 flex items-center justify-center text-gray-300 text-sm">
            Sin datos para el período
          </div>
        } @else {
          <div class="overflow-x-auto">
            <div class="flex items-end gap-1 min-w-max" style="min-height:140px">
              @for (point of chartData(); track point.date) {
                <div class="flex flex-col items-center gap-0.5 group" style="width:32px">
                  <!-- Commission bar (overlay) -->
                  <div class="relative w-full flex flex-col justify-end" style="height:120px">
                    <div
                      class="w-full rounded-t bg-brand-500/20 absolute bottom-0"
                      [style.height.%]="chartMax() > 0 ? (point.grossSales / chartMax()) * 100 : 0"
                    ></div>
                    <div
                      class="w-full rounded-t bg-brand-500 absolute bottom-0"
                      style="width:50%"
                      [style.height.%]="chartMax() > 0 ? (point.commissions / chartMax()) * 100 : 0"
                    ></div>
                  </div>
                  <span class="text-[9px] text-gray-400 -rotate-45 origin-top-left mt-1 whitespace-nowrap">
                    {{ point.date | date:'d/M' }}
                  </span>
                </div>
              }
            </div>
            <!-- Legend -->
            <div class="flex gap-4 mt-6 text-xs text-gray-500">
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded bg-brand-500/20 inline-block"></span> Ventas brutas
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded bg-brand-500 inline-block"></span> Comisiones
              </span>
            </div>
          </div>
        }
      </div>
    }

    <!-- ════════════════════════════════════════════ TAB: LIQUIDACIONES -->
    @if (activeTab() === 'payouts') {
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex gap-1">
          @for (p of payoutPresets; track p.value) {
            <button
              (click)="setPayoutPeriod(p.value)"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              [class]="payoutPreset() === p.value
                ? 'bg-brand-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'"
            >{{ p.label }}</button>
          }
        </div>
        <div class="flex items-center gap-2">
          <input type="date" class="input-field w-40 text-sm" [(ngModel)]="payoutFrom" />
          <span class="text-gray-400">—</span>
          <input type="date" class="input-field w-40 text-sm" [(ngModel)]="payoutTo" />
          <button class="btn-primary text-sm" (click)="loadPayouts()">Cargar</button>
        </div>
        <button class="btn-secondary text-sm ml-auto" (click)="exportCsv()">⬇ Exportar CSV</button>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comercio</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventas</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Neto a pagar</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Pedidos</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              @if (payoutsLoading()) {
                @for (i of [1,2,3,4,5]; track i) {
                  <tr class="animate-pulse">
                    @for (j of [1,2,3,4,5,6,7]; track j) {
                      <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    }
                  </tr>
                }
              } @else if (payoutSummaries().length === 0) {
                <tr>
                  <td colspan="7" class="px-4 py-12 text-center text-gray-400 text-sm">
                    Sin datos para el período seleccionado
                  </td>
                </tr>
              } @else {
                @for (s of payoutSummaries(); track s.store_id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 font-medium text-gray-800">{{ s.store_name }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">RD$ {{ s.gross_sales | number:'1.0-0' }}</td>
                    <td class="px-4 py-3 text-right text-brand-500 font-medium">RD$ {{ s.commission_total | number:'1.0-0' }}</td>
                    <td class="px-4 py-3 text-right text-success-600 font-semibold">RD$ {{ s.net_amount | number:'1.0-0' }}</td>
                    <td class="px-4 py-3 text-center text-gray-500">{{ s.order_count }}</td>
                    <td class="px-4 py-3">
                      @if (s.payout_status) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                          [class]="payoutStatusColor(s.payout_status)">
                          {{ s.payout_status }}
                        </span>
                      } @else {
                        <span class="text-gray-300 text-xs">Sin liquidación</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-1">
                        @if (!s.payout_id) {
                          <button class="btn-primary text-xs px-2.5 py-1"
                            (click)="generatePayout(s)"
                            [disabled]="generatingId() === s.store_id">
                            {{ generatingId() === s.store_id ? '...' : 'Generar' }}
                          </button>
                        } @else if (s.payout_status === 'pendiente') {
                          <button class="btn-secondary text-xs px-2.5 py-1"
                            (click)="openMarkPaid(s)">
                            Marcar pagado
                          </button>
                        } @else {
                          <span class="text-xs text-gray-400">✓ Pagado</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
            @if (!payoutsLoading() && payoutSummaries().length > 0) {
              <tfoot class="bg-gray-50 border-t-2 border-gray-200">
                <tr class="font-semibold text-sm">
                  <td class="px-4 py-3 text-gray-600">Total</td>
                  <td class="px-4 py-3 text-right text-gray-800">RD$ {{ totalGross() | number:'1.0-0' }}</td>
                  <td class="px-4 py-3 text-right text-brand-600">RD$ {{ totalCommission() | number:'1.0-0' }}</td>
                  <td class="px-4 py-3 text-right text-success-700">RD$ {{ totalNet() | number:'1.0-0' }}</td>
                  <td class="px-4 py-3 text-center text-gray-600">{{ totalOrders() }}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════ TAB: COMISIONES -->
    @if (activeTab() === 'commissions') {
      <div class="flex flex-wrap items-center gap-2 mb-4">
        @for (p of periodPresets; track p.value) {
          <button
            (click)="setCommPeriod(p.value)"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            [class]="commPeriod() === p.value
              ? 'bg-brand-500 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'"
          >{{ p.label }}</button>
        }
      </div>

      <!-- Reuse payouts summary data filtered for commission view -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comercio</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventas</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tasa efectiva</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Pedidos</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              @if (commLoading()) {
                @for (i of [1,2,3]; track i) {
                  <tr class="animate-pulse">
                    <td colspan="5" class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-full"></div></td>
                  </tr>
                }
              } @else if (commSummaries().length === 0) {
                <tr><td colspan="5" class="px-4 py-10 text-center text-gray-400 text-sm">Sin datos</td></tr>
              } @else {
                @for (s of commSummaries(); track s.store_id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium text-gray-800">{{ s.store_name }}</td>
                    <td class="px-4 py-3 text-right text-gray-700">RD$ {{ s.gross_sales | number:'1.0-0' }}</td>
                    <td class="px-4 py-3 text-right text-brand-500 font-medium">RD$ {{ s.commission_total | number:'1.0-0' }}</td>
                    <td class="px-4 py-3 text-right text-gray-600">
                      {{ s.gross_sales > 0 ? ((s.commission_total / s.gross_sales) * 100 | number:'1.1-1') : 0 }}%
                    </td>
                    <td class="px-4 py-3 text-right text-gray-500">{{ s.order_count }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- ═════════════════════════════════════════ TAB: DELIVERY FEES -->
    @if (activeTab() === 'delivery') {
      <div class="flex flex-wrap items-center gap-2 mb-4">
        @for (p of periodPresets; track p.value) {
          <button
            (click)="setDeliveryPeriod(p.value)"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            [class]="deliveryPeriod() === p.value
              ? 'bg-brand-500 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'"
          >{{ p.label }}</button>
        }
      </div>

      @if (surchargeLoading()) {
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
          }
        </div>
      } @else if (surcharge()) {
        <!-- Surcharge cards -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-2xl mb-1">🌧</p>
            <p class="text-xs text-gray-400">Recargo clima</p>
            <p class="font-bold text-gray-800">{{ surcharge()!.weatherCount }} pedidos</p>
            <p class="text-xs text-brand-500">RD$ {{ surcharge()!.weatherTotal | number:'1.0-0' }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-2xl mb-1">🕐</p>
            <p class="text-xs text-gray-400">Hora pico</p>
            <p class="font-bold text-gray-800">{{ surcharge()!.peakCount }} pedidos</p>
            <p class="text-xs text-brand-500">RD$ {{ surcharge()!.peakTotal | number:'1.0-0' }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-2xl mb-1">🌙</p>
            <p class="text-xs text-gray-400">Nocturno</p>
            <p class="font-bold text-gray-800">{{ surcharge()!.nightCount }} pedidos</p>
            <p class="text-xs text-brand-500">RD$ {{ surcharge()!.nightTotal | number:'1.0-0' }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-2xl mb-1">🎉</p>
            <p class="text-xs text-gray-400">Feriado</p>
            <p class="font-bold text-gray-800">{{ surcharge()!.holidayCount }} pedidos</p>
            <p class="text-xs text-brand-500">RD$ {{ surcharge()!.holidayTotal | number:'1.0-0' }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-2xl mb-1">📈</p>
            <p class="text-xs text-gray-400">Surge pricing</p>
            <p class="font-bold text-gray-800">{{ surcharge()!.surgeCount }} pedidos</p>
            <p class="text-xs text-brand-500">RD$ {{ surcharge()!.surgeTotal | number:'1.0-0' }}</p>
          </div>
        </div>
      }

      <!-- Fee distribution histogram -->
      @if (feeDistribution().length > 0) {
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h3 class="font-semibold text-gray-800 mb-4 text-sm">Distribución de delivery fees cobrados</h3>
          <div class="space-y-2">
            @for (bucket of feeDistribution(); track bucket.range) {
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500 w-20 text-right flex-shrink-0">{{ bucket.range }}</span>
                <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    class="h-5 bg-brand-500 rounded-full transition-all duration-500"
                    [style.width.%]="feeDistMax() > 0 ? (bucket.count / feeDistMax()) * 100 : 0"
                  ></div>
                </div>
                <span class="text-xs font-medium text-gray-700 w-8 flex-shrink-0">{{ bucket.count }}</span>
              </div>
            }
          </div>
        </div>
      }
    }

    <!-- ═══════════════════════════════════════════ TAB: REEMBOLSOS -->
    @if (activeTab() === 'refunds') {
      <div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <p class="text-3xl mb-2">💸</p>
        <p class="font-medium text-gray-600">Módulo de reembolsos</p>
        <p class="text-sm mt-1">Próximamente — requiere tabla <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">refunds</code> en Supabase</p>
      </div>
    }

    <!-- ════════════════════════════ Mark as Paid modal -->
    @if (markPaidModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="markPaidModal.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-1">Marcar como pagado</h3>
          <p class="text-sm text-gray-500 mb-5">{{ markPaidModal()!.store_name }}</p>
          <div class="space-y-4">
            <div>
              <label class="label text-xs">Método de pago</label>
              <select class="input-field" [(ngModel)]="markPaidMethod">
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
            <div>
              <label class="label text-xs">Referencia de pago *</label>
              <input class="input-field" [(ngModel)]="markPaidRef"
                placeholder="Número de transferencia, cheque, etc." />
            </div>
            <div class="bg-gray-50 rounded-lg p-3 text-sm">
              <div class="flex justify-between text-gray-500">
                <span>Neto a pagar</span>
                <span class="font-semibold text-success-600">RD$ {{ markPaidModal()!.net_amount | number:'1.0-0' }}</span>
              </div>
            </div>
          </div>
          <div class="flex gap-3 mt-5 justify-end">
            <button class="btn-secondary" (click)="markPaidModal.set(null)">Cancelar</button>
            <button class="btn-primary" (click)="confirmMarkPaid()"
              [disabled]="!markPaidRef.trim() || markPaidSaving()">
              {{ markPaidSaving() ? 'Guardando...' : 'Confirmar pago' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FinancesPageComponent implements OnInit {
  private readonly service = inject(PayoutsService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<FinanceTab>('summary');
  readonly summaryPeriod = signal<PeriodPreset>('month');
  readonly payoutPreset = signal<'week' | 'month'>('month');
  readonly commPeriod = signal<PeriodPreset>('month');
  readonly deliveryPeriod = signal<PeriodPreset>('month');

  readonly kpi = signal<FinanceKpi | null>(null);
  readonly kpiLoading = signal(false);
  readonly chartData = signal<FinanceDailyPoint[]>([]);
  readonly chartLoading = signal(false);
  readonly chartMax = computed(() => Math.max(...this.chartData().map(d => d.grossSales), 1));

  readonly payoutSummaries = signal<PayoutSummary[]>([]);
  readonly payoutsLoading = signal(false);
  readonly generatingId = signal<string | null>(null);

  readonly commSummaries = signal<PayoutSummary[]>([]);
  readonly commLoading = signal(false);

  readonly surcharge = signal<SurchargeStats | null>(null);
  readonly surchargeLoading = signal(false);
  readonly feeDistribution = signal<DeliveryFeeRange[]>([]);
  readonly feeDistMax = computed(() => Math.max(...this.feeDistribution().map(d => d.count), 1));

  readonly markPaidModal = signal<PayoutSummary | null>(null);
  readonly markPaidSaving = signal(false);
  markPaidMethod: PayoutMethod = 'transferencia';
  markPaidRef = '';

  // Computed totals for payouts table footer
  readonly totalGross = computed(() => this.payoutSummaries().reduce((s, r) => s + r.gross_sales, 0));
  readonly totalCommission = computed(() => this.payoutSummaries().reduce((s, r) => s + r.commission_total, 0));
  readonly totalNet = computed(() => this.payoutSummaries().reduce((s, r) => s + r.net_amount, 0));
  readonly totalOrders = computed(() => this.payoutSummaries().reduce((s, r) => s + r.order_count, 0));

  summaryFrom = '';
  summaryTo = '';
  payoutFrom = '';
  payoutTo = '';

  readonly tabs: { id: FinanceTab; label: string }[] = [
    { id: 'summary', label: 'Resumen' },
    { id: 'payouts', label: 'Liquidaciones' },
    { id: 'commissions', label: 'Comisiones' },
    { id: 'delivery', label: 'Delivery Fees' },
    { id: 'refunds', label: 'Reembolsos' },
  ];

  readonly periodPresets: { label: string; value: PeriodPreset }[] = [
    { label: 'Hoy', value: 'today' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
  ];

  readonly payoutPresets: { label: string; value: 'week' | 'month' }[] = [
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
  ];

  ngOnInit(): void {
    this.setSummaryPeriod('month');
    this.setPayoutPeriod('month');
    this.setCommPeriod('month');
    this.setDeliveryPeriod('month');
  }

  setSummaryPeriod(preset: PeriodPreset): void {
    this.summaryPeriod.set(preset);
    const { from, to } = periodRange(preset);
    this.summaryFrom = from;
    this.summaryTo = to;
    this.loadSummaryKpi();
  }

  loadSummaryKpi(): void {
    this.kpiLoading.set(true);
    this.chartLoading.set(true);
    const from = this.summaryFrom + 'T00:00:00';
    const to = this.summaryTo + 'T23:59:59';
    this.service.getFinanceKpi(from, to).subscribe({
      next: (d) => { this.kpi.set(d); this.kpiLoading.set(false); },
      error: () => { this.toast.error('Error al cargar KPIs'); this.kpiLoading.set(false); },
    });
    this.service.getDailyTimeSeries(from, to).subscribe({
      next: (d) => { this.chartData.set(d); this.chartLoading.set(false); },
      error: () => this.chartLoading.set(false),
    });
  }

  setPayoutPeriod(preset: 'week' | 'month'): void {
    this.payoutPreset.set(preset);
    const { from, to } = payoutPeriodRange(preset);
    this.payoutFrom = from;
    this.payoutTo = to;
    this.loadPayouts();
  }

  loadPayouts(): void {
    this.payoutsLoading.set(true);
    const from = this.payoutFrom + 'T00:00:00';
    const to = this.payoutTo + 'T23:59:59';
    this.service.getPayoutsSummary(from, to).subscribe({
      next: (d) => { this.payoutSummaries.set(d); this.payoutsLoading.set(false); },
      error: () => { this.toast.error('Error al cargar liquidaciones'); this.payoutsLoading.set(false); },
    });
  }

  async generatePayout(summary: PayoutSummary): Promise<void> {
    this.generatingId.set(summary.store_id);
    try {
      const payout = await this.service.generatePayout(
        summary.store_id,
        this.payoutFrom + 'T00:00:00',
        this.payoutTo + 'T23:59:59',
      );
      this.payoutSummaries.update(list => list.map(s =>
        s.store_id === summary.store_id
          ? { ...s, payout_id: payout.id, payout_status: 'pendiente' }
          : s
      ));
      this.toast.success(`Liquidación generada para ${summary.store_name}`);
    } catch {
      this.toast.error('Error al generar liquidación');
    } finally {
      this.generatingId.set(null);
    }
  }

  openMarkPaid(summary: PayoutSummary): void {
    this.markPaidRef = '';
    this.markPaidMethod = 'transferencia';
    this.markPaidModal.set(summary);
  }

  async confirmMarkPaid(): Promise<void> {
    const s = this.markPaidModal()!;
    if (!s.payout_id || !this.markPaidRef.trim()) return;
    this.markPaidSaving.set(true);
    try {
      await this.service.markAsPaid(s.payout_id, this.markPaidMethod, this.markPaidRef.trim());
      this.payoutSummaries.update(list => list.map(ps =>
        ps.store_id === s.store_id ? { ...ps, payout_status: 'pagado' } : ps
      ));
      this.toast.success('Pago registrado correctamente');
      this.markPaidModal.set(null);
    } catch {
      this.toast.error('Error al registrar pago');
    } finally {
      this.markPaidSaving.set(false);
    }
  }

  setCommPeriod(preset: PeriodPreset): void {
    this.commPeriod.set(preset);
    const { from, to } = periodRange(preset);
    this.commLoading.set(true);
    this.service.getPayoutsSummary(from + 'T00:00:00', to + 'T23:59:59').subscribe({
      next: (d) => { this.commSummaries.set(d); this.commLoading.set(false); },
      error: () => this.commLoading.set(false),
    });
  }

  setDeliveryPeriod(preset: PeriodPreset): void {
    this.deliveryPeriod.set(preset);
    const { from, to } = periodRange(preset);
    const fromIso = from + 'T00:00:00';
    const toIso = to + 'T23:59:59';
    this.surchargeLoading.set(true);
    this.service.getSurchargeStats(fromIso, toIso).subscribe({
      next: (d) => { this.surcharge.set(d); this.surchargeLoading.set(false); },
      error: () => this.surchargeLoading.set(false),
    });
    this.service.getDeliveryFeeDistribution(fromIso, toIso).subscribe({
      next: (d) => this.feeDistribution.set(d),
    });
  }

  exportCsv(): void {
    const data = this.payoutSummaries();
    if (!data.length) { this.toast.error('Sin datos para exportar'); return; }
    const headers = ['Comercio', 'Ventas', 'Comisión', 'Neto', 'Pedidos', 'Estado'];
    const rows = data.map(s => [
      `"${s.store_name}"`,
      s.gross_sales.toFixed(2),
      s.commission_total.toFixed(2),
      s.net_amount.toFixed(2),
      s.order_count,
      s.payout_status ?? 'sin_liquidacion',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidaciones_${this.payoutFrom}_${this.payoutTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  payoutStatusColor(status: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-warning-100 text-warning-700',
      pagado: 'bg-success-100 text-success-700',
      cancelado: 'bg-error-100 text-error-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }
}
