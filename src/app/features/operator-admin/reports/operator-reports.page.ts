import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperatorAdminService } from '../operator-admin.service';
import { OperatorBookingsService, BookingListRow } from '../bookings/operator-bookings.service';
import { AppConfigService } from '../../../core/config/app-config.service';

type Period = 'esta_semana' | 'este_mes' | 'tres_meses' | 'custom';

interface ExcursionReport {
    id: string;
    name: string;
    salidas: number;
    personas: number;
    ingresos: number;
    cancelaciones: number;
    rating: number | null;
}

interface BarDay { label: string; bookings: number; revenue: number; }

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

@Component({
    selector: 'app-operator-reports',
    standalone: true,
    imports: [CommonModule, FormsModule, DecimalPipe],
    template: `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">📈 Reportes</h1>
      <button class="btn-export" (click)="exportCsv()" [disabled]="loading()">⬇ Exportar CSV</button>
    </div>

    <!-- Period selector -->
    <div class="period-bar">
      <div class="period-tabs">
        <button [class.active]="period() === 'esta_semana'" (click)="setPeriod('esta_semana')">Esta semana</button>
        <button [class.active]="period() === 'este_mes'" (click)="setPeriod('este_mes')">Este mes</button>
        <button [class.active]="period() === 'tres_meses'" (click)="setPeriod('tres_meses')">3 meses</button>
        <button [class.active]="period() === 'custom'" (click)="setPeriod('custom')">Personalizado</button>
      </div>
      @if (period() === 'custom') {
        <div class="custom-dates">
          <input type="date" [(ngModel)]="customFrom" class="input-date" (change)="load()" />
          <span class="to-label">al</span>
          <input type="date" [(ngModel)]="customTo" class="input-date" (change)="load()" />
        </div>
      }
    </div>

    @if (loading()) { <div class="loading">Calculando reportes…</div> }

    @if (!loading()) {
      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <p class="kpi-label">Reservas confirmadas</p>
          <p class="kpi-value">{{ kpis().confirmed }}</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-label">Ingresos brutos</p>
          <p class="kpi-value">RD$ {{ kpis().gross | number:'1.0-0' }}</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-label">Personas atendidas</p>
          <p class="kpi-value">{{ kpis().people }}</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-label">Ticket promedio</p>
          <p class="kpi-value">RD$ {{ kpis().avgTicket | number:'1.0-0' }}</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-label">Tasa cancelación</p>
          <p class="kpi-value" [class.warn]="kpis().cancelRate > 15">{{ kpis().cancelRate | number:'1.1-1' }}%</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-label">Calificación promedio</p>
          <p class="kpi-value">⭐ {{ (operatorSvc.activeOperator()?.avg_rating ?? 0) | number:'1.1-1' }}</p>
        </div>
      </div>

      <!-- SVG bar chart: bookings + revenue per day -->
      @if (barData().length > 0) {
        <div class="chart-card">
          <h3 class="chart-title">Reservas por día</h3>
          <div class="chart-wrap">
            <svg [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" class="bar-svg">
              <!-- Grid lines -->
              @for (gl of gridLines(); track gl.y) {
                <line [attr.x1]="padL" [attr.y1]="gl.y" [attr.x2]="svgW - padR" [attr.y2]="gl.y"
                  stroke="#f3f4f6" stroke-width="1" />
                <text [attr.x]="padL - 6" [attr.y]="gl.y + 4" text-anchor="end" font-size="9" fill="#d1d5db">{{ gl.val }}</text>
              }
              <!-- Bars -->
              @for (bar of barData(); track bar.label; let i = $index) {
                <rect
                  [attr.x]="barX(i)"
                  [attr.y]="barY(bar)"
                  [attr.width]="barW()"
                  [attr.height]="barH(bar)"
                  rx="4" fill="#e91e8c" fill-opacity="0.85" />
                <text [attr.x]="barX(i) + barW() / 2" [attr.y]="svgH - padB + 12"
                  text-anchor="middle" font-size="8" fill="#9ca3af">{{ bar.label.slice(5) }}</text>
              }
            </svg>
          </div>
        </div>
      }

      <!-- Per-excursion table -->
      <div class="card">
        <h3 class="card-section-title">Por excursión</h3>
        @if (excursionReports().length === 0) {
          <p class="empty">No hay datos para el período seleccionado.</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Excursión</th><th>Salidas</th><th>Personas</th>
                  <th>Ingresos</th><th>Cancelaciones</th><th>Rating</th>
                </tr>
              </thead>
              <tbody>
                @for (row of excursionReports(); track row.id) {
                  <tr>
                    <td class="exc-name">{{ row.name }}</td>
                    <td>{{ row.salidas }}</td>
                    <td>{{ row.personas }}</td>
                    <td>RD$ {{ row.ingresos | number:'1.0-0' }}</td>
                    <td [class.text-red]="row.cancelaciones > 0">{{ row.cancelaciones }}</td>
                    <td>{{ row.rating !== null ? '⭐ ' + (row.rating | number:'1.1-1') : '—' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="totals-row">
                  <td><strong>Total</strong></td>
                  <td><strong>{{ totals().salidas }}</strong></td>
                  <td><strong>{{ totals().personas }}</strong></td>
                  <td><strong>RD$ {{ totals().ingresos | number:'1.0-0' }}</strong></td>
                  <td><strong>{{ totals().cancelaciones }}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </div>

      <!-- Cancellation analysis -->
      @if (cancelledBookings().length > 0) {
        <div class="card">
          <h3 class="card-section-title">Análisis de cancelaciones</h3>
          <div class="cancel-grid">
            <div class="cancel-stat">
              <p class="cancel-label">Por cliente</p>
              <p class="cancel-val">{{ cancelStats().byClient }}</p>
            </div>
            <div class="cancel-stat">
              <p class="cancel-label">Por operador</p>
              <p class="cancel-val">{{ cancelStats().byOperator }}</p>
            </div>
            <div class="cancel-stat">
              <p class="cancel-label">Anticipación promedio</p>
              <p class="cancel-val">{{ cancelStats().avgHours | number:'1.0-0' }} h</p>
            </div>
          </div>
          @if (cancelReasons().length > 0) {
            <div style="margin-top:1rem">
              <p class="label">Palabras frecuentes en motivos</p>
              <div class="reason-chips">
                @for (r of cancelReasons().slice(0,15); track r.word) {
                  <span class="reason-chip" [style.font-size]="(0.7 + r.freq * 0.15) + 'rem'">{{ r.word }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
    }
  </div>
  `,
    styles: [`
    .page { max-width:1050px; margin:0 auto; }
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; }
    .page-title { font-size:1.5rem; font-weight:800; color:#111827; margin:0; }
    .btn-export { background:white; border:1px solid #e5e7eb; border-radius:10px; padding:.45rem .95rem; font-size:.8rem; cursor:pointer; }
    .btn-export:hover { border-color:#e91e8c; color:#e91e8c; }
    .btn-export:disabled { opacity:.5; }

    .period-bar { display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap; }
    .period-tabs { display:flex; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
    .period-tabs button { background:white; border:none; padding:.4rem .85rem; font-size:.8rem; cursor:pointer; color:#6b7280; }
    .period-tabs button.active { background:#e91e8c; color:white; font-weight:600; }
    .custom-dates { display:flex; align-items:center; gap:.5rem; }
    .input-date { border:1px solid #e5e7eb; border-radius:8px; padding:.35rem .65rem; font-size:.8rem; outline:none; }
    .input-date:focus { border-color:#e91e8c; }
    .to-label { font-size:.8rem; color:#6b7280; }

    /* KPIs */
    .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.85rem; margin-bottom:1.25rem; }
    @media(max-width:640px){ .kpi-grid { grid-template-columns:1fr 1fr; } }
    @media(max-width:380px){ .kpi-grid { grid-template-columns:1fr; } }
    .kpi-card { background:white; border:1px solid #e5e7eb; border-radius:14px; padding:.85rem 1rem; }
    .kpi-label { font-size:.68rem; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin:0 0 .35rem; }
    .kpi-value { font-size:1.35rem; font-weight:800; color:#111827; margin:0; }
    .kpi-value.warn { color:#e91e8c; }

    /* Chart */
    .chart-card { background:white; border:1px solid #e5e7eb; border-radius:14px; padding:1rem 1.25rem; margin-bottom:1rem; }
    .chart-title { font-size:.875rem; font-weight:700; color:#111827; margin:0 0 .75rem; }
    .chart-wrap { width:100%; overflow-x:auto; }
    .bar-svg { width:100%; min-width:300px; display:block; }

    /* Card override for this page (14px radius) */
    .card { border-radius:14px; margin-bottom:1rem; }
    .card-section-title { font-size:.875rem; font-weight:700; color:#111827; margin:0 0 1rem; }
    .empty { font-size:.8rem; color:#9ca3af; }

    /* Table extras */
    .data-table .exc-name { font-weight:600; color:#111827; }
    .data-table .text-red { color:#ef4444; font-weight:700; }
    .label { font-size:.78rem; font-weight:700; color:#374151; }

    /* Cancellation */
    .cancel-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.85rem; }
    @media(max-width:480px){ .cancel-grid { grid-template-columns:1fr; } }
    .cancel-stat { background:#f9fafb; border-radius:10px; padding:.75rem; }
    .cancel-label { font-size:.7rem; font-weight:700; color:#9ca3af; text-transform:uppercase; margin:0 0 .25rem; }
    .cancel-val { font-size:1.35rem; font-weight:800; color:#111827; margin:0; }
    .reason-chips { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.35rem; }
    .reason-chip { background:#fce7f3; color:#e91e8c; border-radius:999px; padding:.1rem .55rem; }
  `],
})
export class OperatorReportsPageComponent implements OnInit {
    readonly operatorSvc = inject(OperatorAdminService);
    private readonly bookingSvc = inject(OperatorBookingsService);
    private readonly configSvc = inject(AppConfigService);

    readonly period = signal<Period>('este_mes');
    customFrom = '';
    customTo = '';
    readonly loading = signal(false);

    readonly allBookings = signal<BookingListRow[]>([]);

    // SVG chart params
    readonly svgW = 700; readonly svgH = 180; readonly padL = 36; readonly padR = 12; readonly padB = 20;

    ngOnInit() {
        const t = new Date();
        this.customTo = isoDate(t);
        this.customFrom = isoDate(addDays(t, -30));
        this.configSvc.load();
        this.load();
    }

    setPeriod(p: Period) { this.period.set(p); this.load(); }

    private periodRange(): { from: string; to: string } {
        const today = new Date();
        switch (this.period()) {
            case 'esta_semana': {
                const monday = new Date(today);
                monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
                return { from: isoDate(monday), to: isoDate(addDays(monday, 6)) };
            }
            case 'este_mes':
                return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
            case 'tres_meses':
                return { from: isoDate(addDays(today, -90)), to: isoDate(today) };
            case 'custom':
                return { from: this.customFrom || isoDate(addDays(today, -30)), to: this.customTo || isoDate(today) };
        }
    }

    async load() {
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId) return;
        this.loading.set(true);
        try {
            const { from, to } = this.periodRange();
            const rows = await this.bookingSvc.listBookings(opId, { dateFrom: from, dateTo: to, status: 'all' });
            this.allBookings.set(rows);
        } finally { this.loading.set(false); }
    }

    readonly confirmedBookings = computed(() =>
        this.allBookings().filter(b => b.status === 'confirmada' || b.status === 'completada'));
    readonly cancelledBookings = computed(() =>
        this.allBookings().filter(b => b.status === 'cancelada'));

    readonly kpis = computed(() => {
        const confirmed = this.confirmedBookings();
        const total = this.allBookings().length;
        const cancelled = this.cancelledBookings().length;
        const gross = confirmed.reduce((s, b) => s + b.total, 0);
        const people = confirmed.reduce((s, b) => s + b.num_people, 0);
        return {
            confirmed: confirmed.length,
            gross,
            people,
            avgTicket: confirmed.length ? gross / confirmed.length : 0,
            cancelRate: total ? (cancelled / total) * 100 : 0,
        };
    });

    readonly excursionReports = computed((): ExcursionReport[] => {
        const map = new Map<string, ExcursionReport>();
        for (const b of this.allBookings()) {
            if (!map.has(b.excursion_id)) {
                map.set(b.excursion_id, { id: b.excursion_id, name: b.excursion_name, salidas: 0, personas: 0, ingresos: 0, cancelaciones: 0, rating: null });
            }
            const r = map.get(b.excursion_id)!;
            if (b.status === 'confirmada' || b.status === 'completada') {
                r.salidas++; r.personas += b.num_people; r.ingresos += b.total;
            }
            if (b.status === 'cancelada') r.cancelaciones++;
        }
        return Array.from(map.values()).sort((a, b) => b.ingresos - a.ingresos);
    });

    readonly totals = computed(() => this.excursionReports().reduce(
        (acc, r) => ({ salidas: acc.salidas + r.salidas, personas: acc.personas + r.personas, ingresos: acc.ingresos + r.ingresos, cancelaciones: acc.cancelaciones + r.cancelaciones }),
        { salidas: 0, personas: 0, ingresos: 0, cancelaciones: 0 }));

    readonly barData = computed((): BarDay[] => {
        const { from, to } = this.periodRange();
        const start = new Date(from + 'T00:00:00');
        const end = new Date(to + 'T00:00:00');
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
        if (diffDays > 60) return []; // skip chart for long ranges
        const map = new Map<string, { bookings: number; revenue: number }>();
        for (let i = 0; i < diffDays; i++) {
            const d = isoDate(addDays(start, i));
            map.set(d, { bookings: 0, revenue: 0 });
        }
        for (const b of this.confirmedBookings()) {
            const d = b.departure_date.slice(0, 10);
            if (map.has(d)) { const e = map.get(d)!; e.bookings++; e.revenue += b.total; }
        }
        return Array.from(map.entries()).map(([label, v]) => ({ label, ...v }));
    });

    private readonly maxBar = computed(() => Math.max(1, ...this.barData().map(b => b.bookings)));

    readonly gridLines = computed(() => {
        const max = this.maxBar();
        const step = Math.max(1, Math.ceil(max / 4));
        const lines = [];
        for (let v = step; v <= max; v += step) {
            const y = this.padL + (this.svgH - this.padB - this.padL) * (1 - v / max);
            lines.push({ y, val: v });
        }
        return lines;
    });

    barX(i: number): number {
        const count = this.barData().length;
        const availW = this.svgW - this.padL - this.padR;
        const w = availW / count;
        return this.padL + i * w + w * 0.1;
    }
    barW(): number {
        const count = this.barData().length || 1;
        return ((this.svgW - this.padL - this.padR) / count) * 0.8;
    }
    barY(bar: BarDay): number {
        const max = this.maxBar();
        const chartH = this.svgH - this.padB - this.padL;
        return this.padL + chartH * (1 - bar.bookings / max);
    }
    barH(bar: BarDay): number {
        const max = this.maxBar();
        const chartH = this.svgH - this.padB - this.padL;
        return chartH * (bar.bookings / max);
    }

    readonly cancelStats = computed(() => {
        const cancelled = this.cancelledBookings();
        let byClient = 0; let byOperator = 0; let totalHours = 0;
        for (const b of cancelled) {
            const reason = ((b as unknown as Record<string, unknown>)['cancellation_reason'] as string | null ?? '').toLowerCase();
            if (reason.includes('operador') || reason.includes('empresa') || reason.includes('nosotros')) byOperator++;
            else byClient++;
            // Rough: compare created_at to departure date
            const created = new Date(b.created_at).getTime();
            const departure = new Date(b.departure_date + 'T' + (b.departure_time || '08:00')).getTime();
            totalHours += Math.max(0, (departure - created) / 3600000);
        }
        return { byClient, byOperator, avgHours: cancelled.length ? totalHours / cancelled.length : 0 };
    });

    readonly cancelReasons = computed(() => {
        const stopWords = new Set(['de', 'la', 'el', 'en', 'un', 'una', 'por', 'con', 'que', 'no', 'se', 'los', 'del', 'las', 'para']);
        const freq = new Map<string, number>();
        for (const b of this.cancelledBookings()) {
            const reason = ((b as unknown as Record<string, unknown>)['cancellation_reason'] as string | null) ?? '';
            for (const word of reason.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w))) {
                freq.set(word, (freq.get(word) ?? 0) + 1);
            }
        }
        return Array.from(freq.entries())
            .map(([word, freq]) => ({ word, freq }))
            .sort((a, b) => b.freq - a.freq)
            .slice(0, 20);
    });

    exportCsv() {
        const rows = this.confirmedBookings();
        if (rows.length === 0) return;
        this.bookingSvc.exportToCsv(rows);
    }
}
