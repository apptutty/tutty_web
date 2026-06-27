import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OperatorAdminService } from '../operator-admin.service';
import { OperatorBookingsService, BookingListRow, BookingFilters } from './operator-bookings.service';
import { BookingStatus } from '../../../core/supabase/database.types';

type Tab = 'pendiente' | 'confirmada' | 'completada' | 'cancelada' | 'all';
const TABS: { key: Tab; label: string }[] = [
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'confirmada', label: 'Confirmadas' },
    { key: 'completada', label: 'Completadas' },
    { key: 'cancelada', label: 'Canceladas' },
    { key: 'all', label: 'Todas' },
];
const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    pendiente: { label: 'Pendiente', bg: '#fef3c7', color: '#92400e' },
    confirmada: { label: 'Confirmada', bg: '#d1fae5', color: '#065f46' },
    completada: { label: 'Completada', bg: '#ede9fe', color: '#5b21b6' },
    cancelada: { label: 'Cancelada', bg: '#fee2e2', color: '#991b1b' },
};

function fmtMoney(n: number) { return 'RD$ ' + n.toLocaleString('es-DO'); }
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(t: string) { if (!t) return ''; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m}${hr >= 12 ? 'pm' : 'am'}`; }
function fmtDateTime(iso: string) { return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

@Component({
    selector: 'app-operator-bookings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">📅 Reservas</h1>
        <p class="page-sub">{{ allBookings().length }} en total</p>
      </div>
      <button class="btn-outline" (click)="exportCsv()" [disabled]="filtered().length === 0">⬇ Exportar CSV</button>
    </div>

    @if (error()) { <div class="error-banner">{{ error() }}</div> }

    <!-- Tabs -->
    <div class="tabs">
      @for (tab of tabs; track tab.key) {
        <button class="tab-btn" [class.active]="activeTab() === tab.key" (click)="setTab(tab.key)">
          {{ tab.label }}
          @if (tab.key !== 'all' && countByStatus(tab.key) > 0) {
            <span class="tab-badge" [class.tab-badge--urgent]="tab.key === 'pendiente'">{{ countByStatus(tab.key) }}</span>
          }
        </button>
      }
    </div>

    <!-- Filters -->
    <div class="filters">
      <input class="filter-input" [(ngModel)]="search" placeholder="🔍 Búsqueda por # o cliente…"
        (ngModelChange)="applyFilters()" />
      <select class="filter-select" [(ngModel)]="filterExcursion" (ngModelChange)="applyFilters()">
        <option value="">Todas las excursiones</option>
        @for (exc of excursions(); track exc.id) {
          <option [value]="exc.id">{{ exc.name }}</option>
        }
      </select>
      <input type="date" class="filter-input" [(ngModel)]="filterDateFrom" (ngModelChange)="applyFilters()" placeholder="Desde" />
      <input type="date" class="filter-input" [(ngModel)]="filterDateTo" (ngModelChange)="applyFilters()" placeholder="Hasta" />
      @if (search || filterExcursion || filterDateFrom || filterDateTo) {
        <button class="clear-btn" (click)="clearFilters()">✕ Limpiar</button>
      }
    </div>

    <!-- Table -->
    @if (loading()) {
      <div class="skeleton-table">
        @for (i of [1,2,3,4,5]; track i) { <div class="skeleton-row"></div> }
      </div>
    } @else if (filtered().length === 0) {
      <div class="empty-state">
        <p>📋</p>
        <p>No hay reservas que coincidan con los filtros.</p>
      </div>
    } @else {
      <div class="table-wrapper">
        <table class="bookings-table">
          <thead>
            <tr>
              <th># Reserva</th>
              <th>Excursión</th>
              <th>Fecha salida</th>
              <th>Cliente</th>
              <th class="center">Personas</th>
              <th class="right">Total</th>
              <th class="center">Estado</th>
              <th>Reservado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (bk of filtered(); track bk.id) {
              <tr (click)="viewDetail(bk.id)" class="table-row">
                <td class="mono">{{ bk.booking_number ?? bk.id.slice(0,8) }}</td>
                <td>
                  <p class="exc-name">{{ bk.excursion_name }}</p>
                </td>
                <td class="nowrap">{{ fmtDate(bk.departure_date) }}<br /><span class="time-text">{{ fmtTime(bk.departure_time) }}</span></td>
                <td>
                  <p class="customer-name">{{ bk.customer_name }}</p>
                  @if (bk.customer_phone) {
                    <a class="wa-link" [href]="waLink(bk.customer_phone)" target="_blank" (click)="$event.stopPropagation()">📱 WhatsApp</a>
                  }
                </td>
                <td class="center">{{ bk.num_people }}</td>
                <td class="right mono">{{ fmtMoney(bk.total) }}</td>
                <td class="center">
                  <span class="status-badge"
                    [style.background]="statusStyle(bk.status).bg"
                    [style.color]="statusStyle(bk.status).color">
                    {{ statusStyle(bk.status).label }}
                  </span>
                </td>
                <td class="nowrap date-text">{{ fmtDateTime(bk.created_at) }}</td>
                <td (click)="$event.stopPropagation()">
                  <div class="inline-actions">
                    @if (bk.status === 'pendiente') {
                      <button class="btn-confirm" (click)="quickConfirm(bk)" [disabled]="actionId() === bk.id">✅</button>
                      <button class="btn-reject" (click)="openCancel(bk)" [disabled]="actionId() === bk.id">❌</button>
                    }
                    @if (bk.status === 'confirmada' && isPastDate(bk.departure_date)) {
                      <button class="btn-complete" (click)="quickComplete(bk)" [disabled]="actionId() === bk.id">✔ Completar</button>
                    }
                    <button class="btn-view" (click)="viewDetail(bk.id)">👁</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- Cancel modal -->
    @if (cancelTarget()) {
      <div class="modal-overlay" (click)="cancelTarget.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal-title">❌ Cancelar reserva</h3>
          <p class="modal-sub">Reserva <strong>{{ cancelTarget()!.booking_number ?? cancelTarget()!.id.slice(0,8) }}</strong> — {{ cancelTarget()!.customer_name }}</p>
          <div class="form-group">
            <label class="label">Motivo de cancelación *</label>
            <textarea [(ngModel)]="cancelReason" class="input-field" rows="3" placeholder="Explica el motivo de la cancelación…"></textarea>
          </div>
          @if (!cancelReason.trim()) {
            <p class="field-error">El motivo es obligatorio.</p>
          }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="cancelTarget.set(null)">Volver</button>
            <button class="btn-danger" (click)="doCancel()" [disabled]="!cancelReason.trim() || cancelling()">
              {{ cancelling() ? 'Cancelando…' : 'Confirmar cancelación' }}
            </button>
          </div>
        </div>
      </div>
    }
  </div>
  `,
    styles: [`
    .page { max-width:1200px; margin:0 auto; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.25rem; gap:1rem; flex-wrap:wrap; }
    .page-title { font-size:1.5rem; font-weight:700; color:#111827; margin:0; }
    .page-sub { color:#9ca3af; font-size:.8rem; margin:.2rem 0 0; }
    .error-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:.75rem 1rem; color:#b91c1c; font-size:.875rem; margin-bottom:1rem; }

    .tabs { display:flex; gap:.25rem; border-bottom:2px solid #e5e7eb; margin-bottom:1rem; overflow-x:auto; }
    .tab-btn { background:none; border:none; padding:.55rem 1rem; font-size:.85rem; font-weight:500; color:#6b7280; cursor:pointer; white-space:nowrap; border-bottom:2px solid transparent; margin-bottom:-2px; display:flex; align-items:center; gap:.4rem; }
    .tab-btn.active { color:#e91e8c; border-bottom-color:#e91e8c; font-weight:700; }
    .tab-badge { background:#e5e7eb; color:#374151; border-radius:999px; padding:1px 7px; font-size:.7rem; font-weight:700; }
    .tab-badge--urgent { background:#e91e8c; color:white; }

    .filters { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center; }
    .filter-input { border:1px solid #e5e7eb; border-radius:9px; padding:.45rem .75rem; font-size:.8rem; outline:none; }
    .filter-input:focus { border-color:#e91e8c; }
    .filter-select { border:1px solid #e5e7eb; border-radius:9px; padding:.45rem .75rem; font-size:.8rem; outline:none; background:white; }
    .clear-btn { background:none; border:none; color:#9ca3af; font-size:.8rem; cursor:pointer; }
    .clear-btn:hover { color:#ef4444; }

    .skeleton-table { display:flex; flex-direction:column; gap:.5rem; }
    .skeleton-row { height:52px; background:#f3f4f6; border-radius:10px; animation:shimmer 1.2s ease-in-out infinite alternate; }
    @keyframes shimmer { from{opacity:.6} to{opacity:1} }
    .empty-state { background:white; border:1px solid #e5e7eb; border-radius:14px; padding:3rem; text-align:center; color:#9ca3af; }

    .table-wrapper { overflow-x:auto; background:white; border:1px solid #e5e7eb; border-radius:14px; }
    .bookings-table { width:100%; border-collapse:collapse; font-size:.8rem; }
    .bookings-table th { padding:.65rem 1rem; text-align:left; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#9ca3af; border-bottom:1px solid #e5e7eb; background:#fafafa; white-space:nowrap; }
    .bookings-table th.center { text-align:center; }
    .bookings-table th.right { text-align:right; }
    .table-row { border-bottom:1px solid #f3f4f6; cursor:pointer; transition:background .1s; }
    .table-row:hover { background:#fdf2f8; }
    .bookings-table td { padding:.65rem 1rem; vertical-align:middle; color:#374151; }
    .mono { font-family:monospace; font-size:.78rem; color:#6b7280; }
    .center { text-align:center; }
    .right { text-align:right; }
    .nowrap { white-space:nowrap; }
    .exc-name { font-weight:600; color:#111827; margin:0; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .time-text { font-size:.72rem; color:#9ca3af; }
    .customer-name { font-weight:600; margin:0; }
    .wa-link { font-size:.72rem; color:#10b981; text-decoration:none; display:block; }
    .date-text { font-size:.75rem; color:#6b7280; }
    .status-badge { border-radius:999px; padding:2px 9px; font-size:.7rem; font-weight:700; white-space:nowrap; }

    .inline-actions { display:flex; gap:.3rem; align-items:center; }
    .btn-confirm { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; border-radius:7px; padding:.25rem .55rem; font-size:.78rem; cursor:pointer; }
    .btn-confirm:hover { background:#a7f3d0; }
    .btn-reject { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:7px; padding:.25rem .55rem; font-size:.78rem; cursor:pointer; }
    .btn-reject:hover { background:#fecaca; }
    .btn-complete { background:#ede9fe; color:#5b21b6; border:1px solid #c4b5fd; border-radius:7px; padding:.25rem .55rem; font-size:.72rem; cursor:pointer; white-space:nowrap; }
    .btn-view { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:7px; padding:.25rem .55rem; font-size:.78rem; cursor:pointer; }
    .btn-confirm:disabled, .btn-reject:disabled, .btn-complete:disabled { opacity:.4; cursor:not-allowed; }

    /* Modal size for this page */
    .modal { max-width:440px; }
    .modal-sub { font-size:.8rem; color:#6b7280; margin:0 0 1rem; }
  `],
})
export class OperatorBookingsPageComponent implements OnInit {
    private readonly operatorSvc = inject(OperatorAdminService);
    private readonly bookingSvc = inject(OperatorBookingsService);
    readonly router = inject(Router);

    readonly tabs = TABS;
    readonly activeTab = signal<Tab>('pendiente');
    readonly allBookings = signal<BookingListRow[]>([]);
    readonly filtered = signal<BookingListRow[]>([]);
    readonly excursions = signal<{ id: string; name: string }[]>([]);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly actionId = signal<string | null>(null);
    readonly cancelTarget = signal<BookingListRow | null>(null);
    readonly cancelling = signal(false);
    cancelReason = '';

    search = '';
    filterExcursion = '';
    filterDateFrom = '';
    filterDateTo = '';

    readonly fmtMoney = fmtMoney;
    readonly fmtDate = fmtDate;
    readonly fmtTime = fmtTime;
    readonly fmtDateTime = fmtDateTime;

    readonly countByStatus = (status: Tab) => this.allBookings().filter(b => b.status === status).length;
    statusStyle(s: string) { return STATUS_LABELS[s] ?? { label: s, bg: '#f3f4f6', color: '#374151' }; }
    waLink(phone: string) { return `https://wa.me/${phone.replace(/\D/g, '')}`; }
    isPastDate(dateStr: string) { return new Date(dateStr + 'T00:00:00') < new Date(); }

    ngOnInit() { this.load(); }

    async load() {
        this.loading.set(true);
        this.error.set(null);
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId) { this.loading.set(false); return; }
        try {
            const [bookings, excs] = await Promise.all([
                this.bookingSvc.listBookings(opId),
                this.bookingSvc.listOperatorExcursionsForFilter(opId),
            ]);
            this.allBookings.set(bookings);
            this.excursions.set(excs);
            this.applyFilters();
        } catch (e: unknown) {
            this.error.set((e as Error).message);
        } finally {
            this.loading.set(false);
        }
    }

    setTab(tab: Tab) {
        this.activeTab.set(tab);
        this.applyFilters();
    }

    applyFilters() {
        let list = this.allBookings();
        const tab = this.activeTab();
        if (tab !== 'all') list = list.filter(b => b.status === tab);
        if (this.filterExcursion) list = list.filter(b => b.excursion_id === this.filterExcursion);
        if (this.filterDateFrom) list = list.filter(b => b.departure_date >= this.filterDateFrom);
        if (this.filterDateTo) list = list.filter(b => b.departure_date <= this.filterDateTo);
        if (this.search.trim()) {
            const q = this.search.toLowerCase();
            list = list.filter(b =>
                (b.booking_number ?? '').toLowerCase().includes(q) ||
                b.customer_name.toLowerCase().includes(q)
            );
        }
        this.filtered.set(list);
    }

    clearFilters() {
        this.search = ''; this.filterExcursion = ''; this.filterDateFrom = ''; this.filterDateTo = '';
        this.applyFilters();
    }

    viewDetail(id: string) { this.router.navigate(['/operator/bookings', id]); }

    async quickConfirm(bk: BookingListRow) {
        if (this.actionId()) return;
        this.actionId.set(bk.id);
        try {
            const result = await this.bookingSvc.confirmBooking(bk.id);
            if (!result.success) {
                this.error.set(this.approveErrorLabel(result.error));
                return;
            }
            this.allBookings.update(list => list.map(b => b.id === bk.id ? { ...b, status: 'confirmada' as BookingStatus } : b));
            this.applyFilters();
        } finally { this.actionId.set(null); }
    }

    openCancel(bk: BookingListRow) { this.cancelTarget.set(bk); this.cancelReason = ''; }

    async doCancel() {
        const target = this.cancelTarget();
        if (!target || !this.cancelReason.trim()) return;
        this.cancelling.set(true);
        try {
            const result = await this.bookingSvc.cancelBooking(target.id, this.cancelReason);
            if (!result.success) {
                this.error.set(this.cancelErrorLabel(result.error));
                return;
            }
            this.allBookings.update(list => list.map(b => b.id === target.id ? { ...b, status: 'cancelada' as BookingStatus } : b));
            this.applyFilters();
            this.cancelTarget.set(null);
        } finally { this.cancelling.set(false); }
    }

    async quickComplete(bk: BookingListRow) {
        if (this.actionId()) return;
        this.actionId.set(bk.id);
        try {
            const result = await this.bookingSvc.completeBooking(bk.id);
            if (!result.success) {
                this.error.set('Error al completar la reserva. Inténtalo de nuevo.');
                return;
            }
            this.allBookings.update(list => list.map(b => b.id === bk.id ? { ...b, status: 'completada' as BookingStatus } : b));
            this.applyFilters();
        } finally { this.actionId.set(null); }
    }

    private approveErrorLabel(err?: string): string {
        switch (err) {
            case 'not_enough_spots': return 'No hay cupos suficientes para aprobar esta reserva.';
            case 'invalid_status':   return 'Esta reserva ya no está en estado pendiente.';
            case 'unauthorized':     return 'No tienes permiso para aprobar esta reserva.';
            default: return 'Error al aprobar la reserva. Inténtalo de nuevo.';
        }
    }

    private cancelErrorLabel(err?: string): string {
        switch (err) {
            case 'invalid_status': return 'Esta reserva no puede cancelarse en su estado actual.';
            case 'unauthorized':   return 'No tienes permiso para cancelar esta reserva.';
            default: return 'Error al cancelar la reserva. Inténtalo de nuevo.';
        }
    }

    exportCsv() { this.bookingSvc.exportToCsv(this.filtered()); }
}
