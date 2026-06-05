import {
  Component, OnInit, signal, computed, inject, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreAdminService } from '../store-admin.service';
import { StoreReportsService, ReportKPIs, DailySale, TopProduct, StoreReview } from './store-reports.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type Preset = 'hoy' | 'semana' | 'mes' | 'custom';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

@Component({
  selector: 'app-store-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .preset-btn { padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; border: 1px solid #e5e7eb; cursor: pointer; transition: all .15s; background: white; color: #374151; }
    .preset-btn.active { background: #e91e8c; border-color: #e91e8c; color: white; }
    .kpi-card { background: white; border-radius: 14px; padding: 18px 20px; border: 1px solid #f3f4f6; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    .kpi-value { font-size: 1.6rem; font-weight: 700; color: #111827; }
    .kpi-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; margin-top: 2px; }
    .chart-bar { background: #e91e8c; border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s; }
    .heat-cell { width: 100%; aspect-ratio: 1; border-radius: 2px; }
    .star-bar { height: 8px; border-radius: 4px; background: #f9a8d4; overflow: hidden; }
    .star-fill { height: 100%; background: #e91e8c; border-radius: 4px; }
  `],
  template: `
  <div class="min-h-screen bg-gray-50">

    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
      <h1 class="text-xl font-bold text-gray-900">Reportes de ventas</h1>
      <div class="flex items-center gap-2 flex-wrap">
        @for (p of presets; track p.key) {
          <button class="preset-btn" [class.active]="preset() === p.key"
            (click)="setPreset(p.key)">{{ p.label }}</button>
        }
        @if (preset() === 'custom') {
          <input type="date" [(ngModel)]="customFrom" (change)="loadAll()" class="text-sm border border-gray-200 rounded-lg px-2 py-1" />
          <span class="text-gray-400 text-sm">—</span>
          <input type="date" [(ngModel)]="customTo" (change)="loadAll()" class="text-sm border border-gray-200 rounded-lg px-2 py-1" />
        }
        <button (click)="exportCSV()" [disabled]="exporting()"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {{ exporting() ? 'Generando...' : 'Exportar CSV' }}
        </button>
      </div>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">

      <!-- ─── KPI cards ─────────────────────────────────────────────────── -->
      @if (loading()) {
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="kpi-card animate-pulse"><div class="h-8 bg-gray-100 rounded mb-2"></div><div class="h-4 bg-gray-100 rounded w-20"></div></div>
          }
        </div>
      } @else {
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div class="kpi-card">
            <div class="kpi-value">RD\$ {{ kpis().grossSales | number:'1.0-0' }}</div>
            <div class="kpi-label">Ventas brutas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ kpis().orderCount }}</div>
            <div class="kpi-label">Pedidos entregados</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">RD\$ {{ kpis().avgTicket | number:'1.0-0' }}</div>
            <div class="kpi-label">Ticket promedio</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" [class.text-red-600]="kpis().cancelRate > 10">{{ kpis().cancelRate | number:'1.1-1' }}%</div>
            <div class="kpi-label">Tasa cancelación</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ kpis().productsSold }}</div>
            <div class="kpi-label">Productos vendidos</div>
          </div>
        </div>
      }

      <!-- ─── Bar chart: daily sales ────────────────────────────────────── -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-800 mb-4">Ventas por día</h3>
        @if (loading()) {
          <div class="h-40 bg-gray-50 rounded-xl animate-pulse"></div>
        } @else if (dailySales().length === 0) {
          <div class="h-40 flex items-center justify-center text-gray-400 text-sm">Sin datos para este período</div>
        } @else {
          <div class="flex items-end gap-1 h-40 overflow-x-auto pb-1">
            @for (day of dailySales(); track day.date) {
              <div class="flex flex-col items-center gap-1 flex-1 min-w-6 group">
                <div class="relative w-full">
                  <div class="chart-bar w-full"
                    [style.height.px]="barHeight(day.total)"
                    [title]="'RD$ ' + (day.total | number:'1.0-0')">
                  </div>
                  <!-- tooltip -->
                  <div class="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                    {{ day.date | date:'dd/MM' }}: RD\$ {{ day.total | number:'1.0-0' }}
                  </div>
                </div>
                <span class="text-gray-400 text-xs">{{ day.date | date:'dd/MM' }}</span>
              </div>
            }
          </div>
        }
      </div>

      <div class="grid md:grid-cols-2 gap-6">

        <!-- ─── Top Products ─────────────────────────────────────────────── -->
        <div class="card overflow-hidden">
          <div class="p-4 border-b border-gray-100">
            <h3 class="font-semibold text-gray-800">Top 10 productos</h3>
          </div>
          @if (loading()) {
            <div class="p-4 space-y-2">
              @for (i of [1,2,3]; track i) {
                <div class="h-10 bg-gray-50 rounded-lg animate-pulse"></div>
              }
            </div>
          } @else if (topProducts().length === 0) {
            <div class="p-8 text-center text-gray-400 text-sm">Sin ventas en este período</div>
          } @else {
            <div class="divide-y divide-gray-100">
              @for (p of topProducts(); track p.name; let i = $index) {
                <div class="flex items-center gap-3 px-4 py-2.5">
                  <span class="text-xs font-bold text-gray-400 w-5">{{ i + 1 }}</span>
                  @if (p.photo_url) {
                    <img [src]="p.photo_url" [alt]="p.name" class="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  } @else {
                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">🍽️</div>
                  }
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ p.name }}</p>
                    <p class="text-xs text-gray-400">{{ p.qty }} uds.</p>
                  </div>
                  <span class="text-sm font-semibold text-gray-700">RD\$ {{ p.revenue | number:'1.0-0' }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- ─── Reviews ──────────────────────────────────────────────────── -->
        <div class="card overflow-hidden">
          <div class="p-4 border-b border-gray-100">
            <h3 class="font-semibold text-gray-800">Reseñas recientes</h3>
          </div>
          @if (reviews().length === 0) {
            <div class="p-8 text-center">
              <p class="text-gray-400 text-sm">No hay reseñas registradas todavía.</p>
              <p class="text-gray-300 text-xs mt-1">Las reseñas de clientes aparecerán aquí.</p>
            </div>
          } @else {
            <!-- Star distribution -->
            <div class="px-4 pt-3 pb-2 space-y-1">
              @for (star of [5,4,3,2,1]; track star) {
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-gray-500 w-5 text-right">{{ star }}★</span>
                  <div class="star-bar flex-1">
                    <div class="star-fill" [style.width.%]="starPct(star)"></div>
                  </div>
                  <span class="text-gray-400 w-5">{{ starCount(star) }}</span>
                </div>
              }
            </div>
            <!-- List -->
            <div class="divide-y divide-gray-100 max-h-52 overflow-y-auto">
              @for (r of reviews(); track r.id) {
                <div class="px-4 py-2.5">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-yellow-400 text-sm">{{ '★'.repeat(r.rating) }}<span class="text-gray-200">{{ '★'.repeat(5 - r.rating) }}</span></span>
                    <span class="text-xs text-gray-400">{{ r.created_at | date:'dd/MM/yy' }}</span>
                  </div>
                  @if (r.comment) {
                    <p class="text-xs text-gray-600 leading-relaxed">{{ r.comment }}</p>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- ─── Demand Heatmap ────────────────────────────────────────────── -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-800 mb-4">Mapa de demanda — pedidos por hora y día</h3>
        @if (loading()) {
          <div class="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
        } @else {
          <div class="overflow-x-auto">
            <!-- Hour labels -->
            <div class="flex mb-1 ml-10">
              @for (h of hours; track h) {
                <div class="text-gray-400 flex-none w-6 text-center" style="font-size:9px">{{ h % 3 === 0 ? h : '' }}</div>
              }
            </div>
            <!-- Rows per day -->
            @for (row of heatmap(); track $index) {
              <div class="flex items-center mb-0.5">
                <div class="text-xs text-gray-500 w-10 flex-none text-right pr-2">{{ dayLabels[$index] }}</div>
                @for (val of row; track $index) {
                  <div class="heat-cell flex-none w-6 h-6 rounded mr-0.5"
                    [style.background]="heatColor(val, heatMax())"
                    [title]="val + ' pedidos'">
                  </div>
                }
              </div>
            }
            <!-- Legend -->
            <div class="flex items-center gap-2 mt-3">
              <span class="text-xs text-gray-400">Menos</span>
              @for (step of heatLegend; track step) {
                <div class="w-5 h-4 rounded" [style.background]="step"></div>
              }
              <span class="text-xs text-gray-400">Más</span>
            </div>
          </div>
        }
      </div>

    </div>
  </div>
  `,
})
export class StoreReportsPageComponent implements OnInit {
  private readonly storeAdminSvc = inject(StoreAdminService);
  private readonly reportsSvc = inject(StoreReportsService);
  private readonly toast = inject(ToastService);

  readonly presets: { key: Preset; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ];

  readonly preset = signal<Preset>('semana');
  customFrom = '';
  customTo = '';

  readonly loading = signal(true);
  readonly exporting = signal(false);

  readonly kpis = signal<ReportKPIs>({ grossSales: 0, orderCount: 0, avgTicket: 0, cancelRate: 0, productsSold: 0 });
  readonly dailySales = signal<DailySale[]>([]);
  readonly topProducts = signal<TopProduct[]>([]);
  readonly heatmap = signal<number[][]>(Array.from({ length: 7 }, () => new Array(24).fill(0)));
  readonly reviews = signal<StoreReview[]>([]);

  readonly heatMax = computed(() => {
    let max = 1;
    for (const row of this.heatmap()) for (const v of row) if (v > max) max = v;
    return max;
  });

  readonly dayLabels = DAY_LABELS;
  readonly hours = HOURS;
  readonly heatLegend = ['#fdf2f8', '#f9a8d4', '#f472b6', '#db2777', '#9d174d'];

  readonly barMax = computed(() => Math.max(1, ...this.dailySales().map(d => d.total)));

  constructor() {
    effect(() => {
      const storeId = this.storeAdminSvc.activeStoreId();
      if (storeId) this.loadAll();
    });
  }

  ngOnInit() { }

  setPreset(p: Preset) {
    this.preset.set(p);
    if (p !== 'custom') this.loadAll();
  }

  private getRange(): { from: string; to: string } {
    if (this.preset() === 'custom' && this.customFrom && this.customTo) {
      return { from: `${this.customFrom}T00:00:00`, to: `${this.customTo}T23:59:59` };
    }
    if (this.preset() === 'custom') return StoreReportsService.rangeFor('mes');
    return StoreReportsService.rangeFor(this.preset() as 'hoy' | 'semana' | 'mes');
  }

  async loadAll() {
    const storeId = this.storeAdminSvc.activeStoreId();
    if (!storeId) return;
    this.loading.set(true);
    const { from, to } = this.getRange();
    try {
      const [kpis, daily, top, heat, revs] = await Promise.all([
        this.reportsSvc.getKPIs(storeId, from, to),
        this.reportsSvc.getDailySales(storeId, from, to),
        this.reportsSvc.getTopProducts(storeId, from, to),
        this.reportsSvc.getDemandHeatmap(storeId, from, to),
        this.reportsSvc.getRecentReviews(storeId),
      ]);
      this.kpis.set(kpis);
      this.dailySales.set(daily);
      this.topProducts.set(top);
      this.heatmap.set(heat);
      this.reviews.set(revs);
    } catch {
      this.toast.error('Error al cargar reportes');
    } finally {
      this.loading.set(false);
    }
  }

  barHeight(val: number): number {
    const max = this.barMax();
    return Math.max(2, Math.round((val / max) * 120));
  }

  heatColor(val: number, max: number): string {
    if (val === 0) return '#f9fafb';
    const pct = val / max;
    if (pct < 0.2) return '#fdf2f8';
    if (pct < 0.4) return '#f9a8d4';
    if (pct < 0.6) return '#f472b6';
    if (pct < 0.8) return '#db2777';
    return '#9d174d';
  }

  starCount(star: number): number {
    return this.reviews().filter(r => r.rating === star).length;
  }

  starPct(star: number): number {
    const total = this.reviews().length;
    return total > 0 ? (this.starCount(star) / total) * 100 : 0;
  }

  // ─── CSV export ────────────────────────────────────────────────────────────
  async exportCSV() {
    const storeId = this.storeAdminSvc.activeStoreId();
    if (!storeId) return;
    this.exporting.set(true);
    const { from, to } = this.getRange();
    try {
      const rows = await this.reportsSvc.getOrdersForExport(storeId, from, to);
      if (rows.length === 0) { this.toast.warning('No hay pedidos en este período'); return; }

      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
          const v = String(r[h] ?? '').replace(/"/g, '""');
          return `"${v}"`;
        }).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('CSV descargado');
    } catch {
      this.toast.error('Error al exportar CSV');
    } finally {
      this.exporting.set(false);
    }
  }
}
