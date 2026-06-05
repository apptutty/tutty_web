import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { OperatorAdminService } from '../operator-admin.service';
import {
    OperatorDashboardService,
    OperatorKPIs,
    UpcomingDate,
    PendingBookingRow,
    DashboardAlert,
} from './operator-dashboard.service';

function fmtMoney(amount: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(amount);
}

function dayLabel(dateStr: string): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const d = new Date(dateStr + 'T00:00:00');
    if (d.toDateString() === today.toDateString()) return 'HOY';
    if (d.toDateString() === tomorrow.toDateString()) return 'MAÑANA';
    return d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

function fmtTime(t: string): string {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const h12 = hour % 12 || 12;
    return `${h12}:${m}${ampm}`;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
}

@Component({
    selector: 'app-operator-dashboard',
    standalone: true,
    imports: [CommonModule],
    template: `
  <div class="dash">

    <!-- Header -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">📊 Dashboard</h1>
        @if (operatorSvc.activeOperator()) {
          <p class="dash-sub">{{ operatorSvc.activeOperator()!.name }}</p>
        }
      </div>
      <button class="refresh-btn" (click)="loadAll()" [disabled]="loading()">
        {{ loading() ? '…' : '↻ Actualizar' }}
      </button>
    </div>

    @if (error()) {
      <div class="error-banner">{{ error() }}</div>
    }

    <!-- ── ROW 1: KPI cards ──────────────────────────────────────────────── -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon">💰</div>
        <div class="kpi-body">
          <p class="kpi-label">Ingresos este mes</p>
          <p class="kpi-value">{{ kpis() ? fmtMoney(kpis()!.revenueMonth) : '—' }}</p>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">🎟️</div>
        <div class="kpi-body">
          <p class="kpi-label">Reservas confirmadas</p>
          <p class="kpi-value">{{ kpis()?.confirmedBookingsMonth ?? '—' }}</p>
          <p class="kpi-sub">{{ kpis()?.spotsThisWeek ?? 0 }} cupos esta semana</p>
        </div>
      </div>
      <div class="kpi-card" [class.kpi-card--urgent]="(kpis()?.pendingBookings ?? 0) > 0">
        <div class="kpi-icon">⏳</div>
        <div class="kpi-body">
          <p class="kpi-label">Pendientes de confirmar</p>
          <p class="kpi-value">{{ kpis()?.pendingBookings ?? '—' }}</p>
          @if ((kpis()?.pendingBookings ?? 0) > 0) {
            <p class="kpi-sub urgent">Requieren acción</p>
          }
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">⭐</div>
        <div class="kpi-body">
          <p class="kpi-label">Rating promedio</p>
          <p class="kpi-value">{{ kpis()?.avgRating?.toFixed(1) ?? '—' }}</p>
          <p class="kpi-sub">{{ kpis()?.activeExcursions ?? 0 }} excursiones activas</p>
        </div>
      </div>
    </div>

    <!-- ── ROW 2: Pending bookings ───────────────────────────────────────── -->
    <div class="section-card">
      <div class="section-header">
        <h2 class="section-title">
          ⏳ Reservas pendientes de confirmar
          @if (pendingBookings().length > 0) {
            <span class="badge-count">{{ pendingBookings().length }}</span>
          }
        </h2>
        @if (pendingBookings().length > 5) {
          <button class="link-btn" (click)="router.navigate(['/operator/bookings'])">
            Ver todas ({{ pendingBookings().length }})
          </button>
        }
      </div>

      @if (loadingPending()) {
        <div class="skeleton-list">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-row"></div>
          }
        </div>
      } @else if (pendingBookings().length === 0) {
        <div class="all-clear">
          <span class="all-clear-icon">✅</span>
          <p>¡Todo al día! No tienes reservas pendientes.</p>
        </div>
      } @else {
        <div class="pending-list">
          @for (bk of visiblePending(); track bk.id) {
            <div class="pending-row">
              <div class="pending-info">
                <p class="pending-name">{{ bk.customer_name }}</p>
                <p class="pending-detail">{{ bk.excursion_name }} · {{ fmtDate(bk.excursion_date) }} {{ fmtTime(bk.departure_time) }}</p>
                <p class="pending-meta">{{ bk.num_people }} persona{{ bk.num_people !== 1 ? 's' : '' }} · {{ fmtMoney(bk.total) }} · <span class="time-ago">{{ timeAgo(bk.created_at) }}</span></p>
              </div>
              <div class="pending-actions">
                <button class="btn-confirm" (click)="confirm(bk.id)" [disabled]="actionLoading() === bk.id">
                  @if (actionLoading() === bk.id) { … } @else { ✅ Confirmar }
                </button>
                <button class="btn-cancel" (click)="cancel(bk.id)" [disabled]="actionLoading() === bk.id">
                  ❌ Cancelar
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- ── ROW 3: Upcoming departures ───────────────────────────────────── -->
    <div class="section-card">
      <div class="section-header">
        <h2 class="section-title">🗓️ Próximas salidas (7 días)</h2>
      </div>

      @if (loadingDates()) {
        <div class="skeleton-list">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-row"></div>
          }
        </div>
      } @else if (upcomingDates().length === 0) {
        <div class="empty-state">
          <p>No hay salidas programadas en los próximos 7 días.</p>
        </div>
      } @else {
        <div class="timeline">
          @for (group of groupedDates(); track group.label) {
            <div class="timeline-group">
              <div class="timeline-day">{{ group.label }}</div>
              @for (d of group.dates; track d.id) {
                <div class="timeline-item" (click)="goToDate(d)" role="button" tabindex="0"
                  (keydown.enter)="goToDate(d)">
                  <div class="timeline-dot"
                    [class.dot-full]="d.spotsLeft === 0"
                    [class.dot-low]="d.spotsLeft > 0 && d.spotsLeft <= 3"
                    [class.dot-ok]="d.spotsLeft > 3"></div>
                  <div class="timeline-content">
                    <p class="timeline-name">{{ d.excursionName }}</p>
                    <p class="timeline-meta">
                      🕐 {{ fmtTime(d.departureTime) }} &nbsp;·&nbsp;
                      👥 {{ d.confirmedPeople }}/{{ d.totalSpots }} cupos
                      @if (d.spotsLeft === 0) {
                        <span class="tag-full">LLENA</span>
                      } @else if (d.spotsLeft <= 3) {
                        <span class="tag-low">{{ d.spotsLeft }} cupo{{ d.spotsLeft !== 1 ? 's' : '' }}</span>
                      }
                    </p>
                  </div>
                  <span class="timeline-arrow">›</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- ── ROW 4: Alerts ─────────────────────────────────────────────────── -->
    @if (alerts().length > 0) {
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">🔔 Alertas</h2>
        </div>
        <div class="alerts-list">
          @for (alert of alerts(); track alert.message) {
            <div class="alert-row" [class]="'alert-' + alert.level">
              <span class="alert-dot"></span>
              <p class="alert-text">{{ alert.message }}</p>
            </div>
          }
        </div>
      </div>
    }

  </div>
  `,
    styles: [`
    .dash { max-width:900px; margin:0 auto; }
    .dash-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.5rem; }
    .dash-title { font-size:1.5rem; font-weight:700; color:#111827; margin:0; }
    .dash-sub { color:#6b7280; font-size:.875rem; margin:.2rem 0 0; }
    .refresh-btn { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:.4rem .9rem; font-size:.8rem; color:#6b7280; cursor:pointer; }
    .refresh-btn:hover { border-color:#e91e8c; color:#e91e8c; }
    .error-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:.75rem 1rem; color:#b91c1c; font-size:.875rem; margin-bottom:1rem; }

    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:1.25rem; }
    @media(max-width:768px){ .kpi-grid { grid-template-columns:1fr 1fr; } }
    @media(max-width:480px){ .kpi-grid { grid-template-columns:1fr; } }
    .kpi-card { background:white; border:1px solid #e5e7eb; border-radius:14px; padding:1rem 1.1rem; display:flex; gap:.75rem; align-items:flex-start; }
    .kpi-card--urgent { border-color:#fde68a; background:#fffbeb; }
    .kpi-icon { font-size:1.6rem; flex-shrink:0; }
    .kpi-body { min-width:0; }
    .kpi-label { font-size:.7rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:#9ca3af; margin:0; }
    .kpi-value { font-size:1.4rem; font-weight:700; color:#111827; margin:.15rem 0 0; line-height:1.2; }
    .kpi-sub { font-size:.72rem; color:#6b7280; margin:.15rem 0 0; }
    .kpi-sub.urgent { color:#d97706; font-weight:600; }

    .section-card { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:1.25rem; margin-bottom:1.25rem; }
    .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
    .section-title { font-size:.9rem; font-weight:700; color:#111827; margin:0; display:flex; align-items:center; gap:.5rem; }
    .badge-count { background:#e91e8c; color:white; font-size:.68rem; font-weight:700; border-radius:999px; padding:1px 7px; }
    .link-btn { background:none; border:none; color:#e91e8c; font-size:.8rem; font-weight:600; cursor:pointer; text-decoration:underline; }

    .skeleton-list { display:flex; flex-direction:column; gap:.5rem; }
    .skeleton-row { height:56px; background:#f3f4f6; border-radius:10px; animation:shimmer 1.2s ease-in-out infinite alternate; }
    @keyframes shimmer { from{opacity:.6} to{opacity:1} }

    .all-clear { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:1.25rem; display:flex; align-items:center; gap:.75rem; }
    .all-clear-icon { font-size:1.5rem; }
    .all-clear p { color:#166534; font-size:.875rem; margin:0; }

    .pending-list { display:flex; flex-direction:column; gap:.5rem; }
    .pending-row { display:flex; align-items:center; gap:.75rem; background:#fafafa; border:1px solid #f3f4f6; border-radius:12px; padding:.85rem 1rem; }
    @media(max-width:640px){ .pending-row { flex-direction:column; align-items:flex-start; } }
    .pending-info { flex:1; min-width:0; }
    .pending-name { font-size:.875rem; font-weight:600; color:#111827; margin:0; }
    .pending-detail { font-size:.775rem; color:#6b7280; margin:.15rem 0 0; }
    .pending-meta { font-size:.73rem; color:#9ca3af; margin:.1rem 0 0; }
    .time-ago { color:#d97706; }
    .pending-actions { display:flex; gap:.4rem; flex-shrink:0; }
    .btn-confirm { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; border-radius:8px; padding:.35rem .65rem; font-size:.75rem; font-weight:600; cursor:pointer; white-space:nowrap; }
    .btn-confirm:hover { background:#a7f3d0; }
    .btn-confirm:disabled { opacity:.5; cursor:not-allowed; }
    .btn-cancel { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:8px; padding:.35rem .65rem; font-size:.75rem; font-weight:600; cursor:pointer; white-space:nowrap; }
    .btn-cancel:hover { background:#fecaca; }
    .btn-cancel:disabled { opacity:.5; cursor:not-allowed; }

    .timeline { display:flex; flex-direction:column; gap:.25rem; }
    .timeline-group { margin-bottom:.5rem; }
    .timeline-day { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#9ca3af; padding:.25rem 0; margin-bottom:.25rem; border-bottom:1px solid #f3f4f6; }
    .timeline-item { display:flex; align-items:center; gap:.75rem; padding:.65rem .5rem; border-radius:10px; cursor:pointer; transition:background .12s; }
    .timeline-item:hover { background:#fdf2f8; }
    .timeline-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .dot-ok { background:#10b981; }
    .dot-low { background:#f59e0b; }
    .dot-full { background:#ef4444; }
    .timeline-content { flex:1; min-width:0; }
    .timeline-name { font-size:.875rem; font-weight:600; color:#111827; margin:0; }
    .timeline-meta { font-size:.775rem; color:#6b7280; margin:.15rem 0 0; display:flex; align-items:center; gap:.35rem; flex-wrap:wrap; }
    .tag-full { background:#fee2e2; color:#991b1b; font-size:.65rem; font-weight:700; border-radius:4px; padding:1px 5px; }
    .tag-low { background:#fef3c7; color:#92400e; font-size:.65rem; font-weight:700; border-radius:4px; padding:1px 5px; }
    .timeline-arrow { color:#d1d5db; font-size:1.1rem; flex-shrink:0; }

    .empty-state { text-align:center; color:#9ca3af; font-size:.875rem; padding:.75rem; }

    .alerts-list { display:flex; flex-direction:column; gap:.5rem; }
    .alert-row { display:flex; align-items:flex-start; gap:.6rem; padding:.65rem .85rem; border-radius:10px; }
    .alert-red { background:#fef2f2; border:1px solid #fecaca; }
    .alert-yellow { background:#fffbeb; border:1px solid #fde68a; }
    .alert-green { background:#f0fdf4; border:1px solid #bbf7d0; }
    .alert-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:4px; }
    .alert-red .alert-dot { background:#ef4444; }
    .alert-yellow .alert-dot { background:#f59e0b; }
    .alert-green .alert-dot { background:#10b981; }
    .alert-text { font-size:.8rem; color:#374151; margin:0; line-height:1.5; }
  `],
})
export class OperatorDashboardPageComponent implements OnInit, OnDestroy {
    readonly operatorSvc = inject(OperatorAdminService);
    private readonly dashSvc = inject(OperatorDashboardService);
    readonly router = inject(Router);

    readonly fmtMoney = fmtMoney;
    readonly fmtTime = fmtTime;
    readonly timeAgo = timeAgo;

    readonly kpis = signal<OperatorKPIs | null>(null);
    readonly pendingBookings = signal<PendingBookingRow[]>([]);
    readonly upcomingDates = signal<UpcomingDate[]>([]);
    readonly alerts = signal<DashboardAlert[]>([]);

    readonly loading = signal(false);
    readonly loadingPending = signal(false);
    readonly loadingDates = signal(false);
    readonly actionLoading = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    readonly visiblePending = computed(() => this.pendingBookings().slice(0, 5));

    readonly groupedDates = computed(() => {
        const map = new Map<string, { label: string; dates: UpcomingDate[] }>();
        for (const d of this.upcomingDates()) {
            const label = dayLabel(d.date);
            if (!map.has(label)) map.set(label, { label, dates: [] });
            map.get(label)!.dates.push(d);
        }
        return Array.from(map.values());
    });

    private subs: Subscription[] = [];

    ngOnInit() { this.loadAll(); }
    ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

    loadAll() {
        const operatorId = this.operatorSvc.activeOperatorId();
        if (!operatorId) return;

        this.error.set(null);
        this.loading.set(true);
        this.loadingPending.set(true);
        this.loadingDates.set(true);

        this.subs.push(
            this.dashSvc.getDashboardKPIs(operatorId).subscribe({
                next: k => { this.kpis.set(k); this.loading.set(false); },
                error: () => { this.loading.set(false); this.error.set('Error al cargar los KPIs.'); },
            }),
            this.dashSvc.getPendingBookings(operatorId).subscribe({
                next: b => { this.pendingBookings.set(b); this.loadingPending.set(false); },
                error: () => this.loadingPending.set(false),
            }),
            this.dashSvc.getUpcomingDates(operatorId, 7).subscribe({
                next: d => { this.upcomingDates.set(d); this.loadingDates.set(false); },
                error: () => this.loadingDates.set(false),
            }),
            this.dashSvc.getDashboardAlerts(operatorId).subscribe({
                next: a => this.alerts.set(a),
            }),
        );
    }

    async confirm(bookingId: string) {
        this.actionLoading.set(bookingId);
        try {
            await this.dashSvc.confirmBooking(bookingId);
            this.pendingBookings.update(list => list.filter(b => b.id !== bookingId));
            this.kpis.update(k => k
                ? { ...k, pendingBookings: Math.max(0, k.pendingBookings - 1), confirmedBookingsMonth: k.confirmedBookingsMonth + 1 }
                : k);
        } finally {
            this.actionLoading.set(null);
        }
    }

    async cancel(bookingId: string) {
        this.actionLoading.set(bookingId);
        try {
            await this.dashSvc.cancelBooking(bookingId);
            this.pendingBookings.update(list => list.filter(b => b.id !== bookingId));
            this.kpis.update(k => k ? { ...k, pendingBookings: Math.max(0, k.pendingBookings - 1) } : k);
        } finally {
            this.actionLoading.set(null);
        }
    }

    goToDate(d: UpcomingDate) {
        this.router.navigate(['/operator/excursions', d.excursionId, 'dates']);
    }

    fmtDate(dateStr: string): string {
        if (!dateStr) return '';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
    }
}
