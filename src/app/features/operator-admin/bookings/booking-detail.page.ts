import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OperatorBookingsService, BookingFullDetail } from './operator-bookings.service';
import { ReminderAutomationService } from './reminder-automation.service';
import { BookingStatus } from '../../../core/supabase/database.types';
import { ToastService } from '../../../shared/ui/toast/toast.service';

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
    pendiente: { label: '⏳ Pendiente', bg: '#fef3c7', color: '#92400e' },
    confirmada: { label: '✅ Confirmada', bg: '#d1fae5', color: '#065f46' },
    completada: { label: '✔ Completada', bg: '#ede9fe', color: '#5b21b6' },
    cancelada: { label: '❌ Cancelada', bg: '#fee2e2', color: '#991b1b' },
};

function fmtMoney(n: number) { return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n); }
function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime(t: string) {
    if (!t) return '';
    const [h, m] = t.split(':'); const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'pm' : 'am'}`;
}
function fmtFull(iso: string) {
    return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

@Component({
    selector: 'app-booking-detail',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
  <div class="page">
    <div class="page-header">
      <button class="back-btn" (click)="router.navigate(['/operator/bookings'])">← Reservas</button>
      @if (booking()) {
        <div class="header-info">
          <h1 class="page-title">Reserva #{{ booking()!.booking_number ?? booking()!.id.slice(0,8) }}</h1>
          <span class="status-badge" [style.background]="statusCfg.bg" [style.color]="statusCfg.color">
            {{ statusCfg.label }}
          </span>
        </div>
      }
    </div>

    @if (error()) { <div class="error-banner">{{ error() }}</div> }

    @if (loading()) {
      <div style="text-align:center;padding:3rem;color:#9ca3af">Cargando reserva…</div>
    } @else if (booking()) {

    <div class="detail-layout">

      <!-- ── LEFT CARD ────────────────────────────────────────────────────── -->
      <div class="card left-card">
        <!-- Excursion summary -->
        <div class="card-section">
          <p class="section-label">Excursión</p>
          <p class="exc-name">{{ booking()!.excursion.name }}</p>
          <p class="departure-info">📅 {{ fmtDate(booking()!.excursion_date.date) }}</p>
          <p class="departure-info">🕐 {{ fmtTime(booking()!.excursion_date.departure_time) }}</p>
          @if (booking()!.excursion.meeting_point) {
            <div class="meeting-point">
              <span class="section-label">📍 Punto de encuentro</span>
              <p class="meeting-text">{{ booking()!.excursion.meeting_point }}</p>
            </div>
          }
        </div>

        <div class="divider"></div>

        <!-- Customer -->
        <div class="card-section">
          <p class="section-label">Cliente</p>
          <p class="customer-name">{{ booking()!.customer.full_name }}</p>
          @if (booking()!.customer.phone) {
            <div class="contact-row">
              <span>📱 {{ booking()!.customer.phone }}</span>
              <a class="wa-btn" [href]="waLink(booking()!.customer.phone!)" target="_blank">WhatsApp →</a>
            </div>
          }
          @if (booking()!.customer.email) {
            <p class="contact-text">✉️ {{ booking()!.customer.email }}</p>
          }
          @if (booking()!.special_requests) {
            <div class="special-requests">
              <p class="section-label" style="margin-bottom:.25rem">💬 Solicitudes especiales</p>
              <p class="special-text">{{ booking()!.special_requests }}</p>
            </div>
          }
        </div>

        <!-- Participants -->
        @if (booking()!.participants.length > 0) {
          <div class="divider"></div>
          <div class="card-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
              <p class="section-label" style="margin:0">👥 Participantes ({{ booking()!.participants.length }})</p>
              <button class="btn-export" (click)="exportParticipants()">⬇ CSV</button>
            </div>
            <table class="participants-table">
              <thead><tr><th>#</th><th>Nombre</th><th>Cédula</th><th>Teléfono</th></tr></thead>
              <tbody>
                @for (p of booking()!.participants; track p.id; let i = $index) {
                  <tr>
                    <td>{{ i + 1 }}</td>
                    <td>{{ p.full_name }}</td>
                    <td>{{ p.cedula ?? '—' }}</td>
                    <td>{{ p.phone ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- ── RIGHT CARD ───────────────────────────────────────────────────── -->
      <div class="right-col">

        <!-- Financial -->
        <div class="card">
          <div class="card-section">
            <p class="section-label">Resumen financiero</p>
            <div class="finance-row">
              <span>Precio por persona</span>
              <span>{{ fmtMoney(booking()!.excursion.price_per_person) }}</span>
            </div>
            <div class="finance-row">
              <span>Personas</span>
              <span>× {{ booking()!.num_people }}</span>
            </div>
            <div class="divider" style="margin:.5rem 0"></div>
            <div class="finance-row total-row">
              <span>Total</span>
              <span>{{ fmtMoney(booking()!.total) }}</span>
            </div>
          </div>
        </div>

        <!-- History -->
        <div class="card" style="margin-top:1rem">
          <div class="card-section">
            <p class="section-label">Historial</p>
            <div class="timeline">
              <div class="tl-item">
                <span class="tl-dot dot-neutral"></span>
                <div>
                  <p class="tl-label">📌 Reserva creada</p>
                  <p class="tl-time">{{ fmtFull(booking()!.created_at) }}</p>
                </div>
              </div>
              @if (booking()!.confirmed_at) {
                <div class="tl-item">
                  <span class="tl-dot dot-green"></span>
                  <div>
                    <p class="tl-label">✅ Confirmada</p>
                    <p class="tl-time">{{ fmtFull(booking()!.confirmed_at!) }}</p>
                  </div>
                </div>
              }
              @if (booking()!.reminder_sent_at) {
                <div class="tl-item">
                  <span class="tl-dot dot-blue"></span>
                  <div>
                    <p class="tl-label">📱 Recordatorio enviado</p>
                    <p class="tl-time">{{ fmtFull(booking()!.reminder_sent_at!) }}</p>
                  </div>
                </div>
              }
              @if (booking()!.completed_at) {
                <div class="tl-item">
                  <span class="tl-dot dot-purple"></span>
                  <div>
                    <p class="tl-label">✔ Completada</p>
                    <p class="tl-time">{{ fmtFull(booking()!.completed_at!) }}</p>
                  </div>
                </div>
              }
              @if (booking()!.cancelled_at) {
                <div class="tl-item">
                  <span class="tl-dot dot-red"></span>
                  <div>
                    <p class="tl-label">❌ Cancelada</p>
                    <p class="tl-time">{{ fmtFull(booking()!.cancelled_at!) }}</p>
                    @if (booking()!.cancellation_reason) {
                      <p class="tl-reason">Motivo: {{ booking()!.cancellation_reason }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="card" style="margin-top:1rem">
          <div class="card-section actions-section">
            @if (booking()!.status === 'pendiente') {
              <button class="btn-action btn-action--confirm" (click)="confirmBooking()" [disabled]="actionLoading()">
                {{ actionLoading() ? 'Procesando…' : '✅ CONFIRMAR RESERVA' }}
              </button>
              <button class="btn-action btn-action--cancel" (click)="openCancelModal()">
                ❌ Cancelar / Rechazar
              </button>
            }
            @if (booking()!.status === 'confirmada') {
              @if (isPastDate()) {
                <button class="btn-action btn-action--complete" (click)="completeBooking()" [disabled]="actionLoading()">
                  {{ actionLoading() ? 'Procesando…' : '✔ Marcar como Completada' }}
                </button>
              }
              @if (!booking()!.reminder_sent_at && isUpcoming()) {
                <button class="btn-action btn-action--reminder" (click)="sendReminder()" [disabled]="reminderLoading()">
                  {{ reminderLoading() ? 'Enviando…' : '📱 Enviar recordatorio WhatsApp' }}
                </button>
              }
              @if (booking()!.reminder_sent_at) {
                <div class="reminder-sent">✅ Recordatorio enviado</div>
              }
              <button class="btn-action btn-action--cancel-sm" (click)="openCancelModal()">
                Cancelar reserva
              </button>
            }
            @if (booking()!.status === 'completada' || booking()!.status === 'cancelada') {
              <p style="text-align:center;color:#9ca3af;font-size:.8rem">No hay acciones disponibles.</p>
            }
          </div>
        </div>

      </div><!-- end right-col -->
    </div><!-- end detail-layout -->

    <!-- Cancel modal -->
    @if (showCancelModal()) {
      <div class="modal-overlay" (click)="showCancelModal.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal-title">❌ Cancelar reserva</h3>
          <p class="modal-sub">Esta acción notificará al cliente y no se puede deshacer.</p>
          <div class="form-group">
            <label class="label">Motivo * (se mostrará al cliente)</label>
            <textarea [(ngModel)]="cancelReason" class="input-field" rows="3"
              placeholder="Ej. Mal tiempo previsto, no se alcanzó el mínimo de personas…"></textarea>
          </div>
          @if (cancelError()) { <p class="field-error">{{ cancelError() }}</p> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="showCancelModal.set(false)">Volver</button>
            <button class="btn-danger" (click)="doCancel()" [disabled]="!cancelReason.trim() || actionLoading()">
              {{ actionLoading() ? 'Cancelando…' : 'Confirmar cancelación' }}
            </button>
          </div>
        </div>
      </div>
    }

    } <!-- end @if booking -->
  </div>
  `,
    styles: [`
    .page { max-width:1000px; margin:0 auto; }
    .page-header { display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; }
    .back-btn { background:none; border:none; color:#6b7280; cursor:pointer; font-size:.875rem; padding:0; white-space:nowrap; }
    .header-info { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
    .page-title { font-size:1.25rem; font-weight:700; color:#111827; margin:0; }
    .status-badge { border-radius:999px; padding:3px 12px; font-size:.8rem; font-weight:700; }

    .detail-layout { display:grid; grid-template-columns:3fr 2fr; gap:1.25rem; align-items:start; }
    @media(max-width:800px) { .detail-layout { grid-template-columns:1fr; } }

    /* card override — left card uses overflow:hidden */
    .left-card { overflow:hidden; }
    .right-col { display:flex; flex-direction:column; }
    .card-section { padding:1.25rem; }
    .divider { height:1px; background:#f3f4f6; }
    .section-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin:0 0 .5rem; }
    .exc-name { font-size:1rem; font-weight:700; color:#111827; margin:0 0 .4rem; }
    .departure-info { font-size:.875rem; color:#374151; margin:0 0 .2rem; }
    .meeting-point { margin-top:.75rem; background:#f9fafb; border-radius:10px; padding:.65rem .85rem; }
    .meeting-text { font-size:.8rem; color:#4b5563; margin:.2rem 0 0; }
    .customer-name { font-size:.95rem; font-weight:700; color:#111827; margin:0 0 .5rem; }
    .contact-row { display:flex; align-items:center; gap:.75rem; margin-bottom:.25rem; font-size:.875rem; color:#374151; }
    .wa-btn { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; border-radius:8px; padding:2px 10px; font-size:.75rem; font-weight:600; text-decoration:none; cursor:pointer; }
    .wa-btn:hover { background:#a7f3d0; }
    .contact-text { font-size:.875rem; color:#374151; margin:.2rem 0; }
    .special-requests { background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:.65rem .85rem; margin-top:.75rem; }
    .special-text { font-size:.8rem; color:#374151; margin:.15rem 0 0; }

    .btn-export { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:.25rem .7rem; font-size:.72rem; cursor:pointer; color:#374151; }
    .btn-export:hover { background:#e5e7eb; }

    .participants-table { width:100%; border-collapse:collapse; font-size:.78rem; }
    .participants-table th { padding:.4rem .6rem; text-align:left; font-size:.68rem; font-weight:700; text-transform:uppercase; color:#9ca3af; border-bottom:1px solid #e5e7eb; }
    .participants-table td { padding:.5rem .6rem; border-bottom:1px solid #f3f4f6; color:#374151; }
    .participants-table tr:last-child td { border-bottom:none; }

    .finance-row { display:flex; justify-content:space-between; align-items:center; font-size:.875rem; color:#374151; padding:.25rem 0; }
    .total-row { font-size:1.1rem; font-weight:700; color:#111827; }

    .timeline { display:flex; flex-direction:column; gap:.75rem; }
    .tl-item { display:flex; gap:.75rem; align-items:flex-start; }
    .tl-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:4px; }
    .dot-neutral { background:#d1d5db; }
    .dot-green { background:#10b981; }
    .dot-blue { background:#3b82f6; }
    .dot-purple { background:#8b5cf6; }
    .dot-red { background:#ef4444; }
    .tl-label { font-size:.8rem; font-weight:600; color:#111827; margin:0; }
    .tl-time { font-size:.72rem; color:#9ca3af; margin:.15rem 0 0; }
    .tl-reason { font-size:.72rem; color:#6b7280; margin:.15rem 0 0; font-style:italic; }

    .actions-section { display:flex; flex-direction:column; gap:.5rem; }
    .btn-action { border:none; border-radius:12px; padding:.7rem; font-size:.875rem; font-weight:600; cursor:pointer; width:100%; transition:opacity .15s; }
    .btn-action:disabled { opacity:.5; cursor:not-allowed; }
    .btn-action--confirm { background:#e91e8c; color:white; font-size:1rem; }
    .btn-action--confirm:hover:not(:disabled) { background:#c2196b; }
    .btn-action--cancel { background:white; color:#ef4444; border:2px solid #fca5a5; }
    .btn-action--complete { background:#ede9fe; color:#5b21b6; border:1px solid #c4b5fd; }
    .btn-action--reminder { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .btn-action--cancel-sm { background:white; color:#6b7280; border:1px solid #e5e7eb; font-size:.8rem; }
    .reminder-sent { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:.5rem; text-align:center; font-size:.78rem; color:#166534; font-weight:600; }

    /* Modal size + sub for this page */
    .modal { max-width:440px; }
    .modal-sub { font-size:.8rem; color:#6b7280; margin:0 0 1rem; }
  `],
})
export class BookingDetailPageComponent implements OnInit {
    private readonly bookingSvc = inject(OperatorBookingsService);
    private readonly reminderSvc = inject(ReminderAutomationService);
    private readonly toast = inject(ToastService);
    readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly booking = signal<BookingFullDetail | null>(null);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly actionLoading = signal(false);
    readonly reminderLoading = signal(false);
    readonly showCancelModal = signal(false);
    readonly cancelError = signal<string | null>(null);
    cancelReason = '';

    readonly fmtMoney = fmtMoney;
    readonly fmtDate = fmtDate;
    readonly fmtTime = fmtTime;
    readonly fmtFull = fmtFull;

    get statusCfg() {
        const s = this.booking()?.status ?? 'pendiente';
        return STATUS_CFG[s] ?? { label: s, bg: '#f3f4f6', color: '#374151' };
    }

    waLink(phone: string) { return `https://wa.me/${phone.replace(/\D/g, '')}`; }
    isPastDate() { const d = this.booking()?.excursion_date.date; return d ? new Date(d + 'T00:00:00') < new Date() : false; }
    isUpcoming() {
        const d = this.booking()?.excursion_date.date;
        if (!d) return false;
        const dep = new Date(d + 'T00:00:00');
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2);
        return dep <= tomorrow && dep >= new Date();
    }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) { this.router.navigate(['/operator/bookings']); return; }
        this.loadBooking(id);
    }

    async loadBooking(id: string) {
        this.loading.set(true);
        try {
            const b = await this.bookingSvc.getBookingDetail(id);
            this.booking.set(b);
        } catch (e: unknown) {
            this.error.set((e as Error).message);
        } finally {
            this.loading.set(false);
        }
    }

    async confirmBooking() {
        const b = this.booking();
        if (!b) return;
        this.actionLoading.set(true);
        try {
            await this.bookingSvc.confirmBooking(b.id);
            this.booking.update(bk => bk ? { ...bk, status: 'confirmada' as BookingStatus, confirmed_at: new Date().toISOString() } : bk);
            this.toast.success('✅ Reserva confirmada');
        } catch (e: unknown) {
            this.toast.error((e as Error).message ?? 'Error al confirmar la reserva.');
        } finally { this.actionLoading.set(false); }
    }

    async completeBooking() {
        const b = this.booking();
        if (!b) return;
        this.actionLoading.set(true);
        try {
            await this.bookingSvc.completeBooking(b.id);
            this.booking.update(bk => bk ? { ...bk, status: 'completada' as BookingStatus, completed_at: new Date().toISOString() } : bk);
            this.toast.success('✔ Reserva marcada como completada');
        } catch (e: unknown) {
            this.toast.error((e as Error).message ?? 'Error al completar la reserva.');
        } finally { this.actionLoading.set(false); }
    }

    openCancelModal() { this.cancelReason = ''; this.cancelError.set(null); this.showCancelModal.set(true); }

    async doCancel() {
        if (!this.cancelReason.trim()) { this.cancelError.set('El motivo es obligatorio.'); return; }
        const b = this.booking();
        if (!b) return;
        this.actionLoading.set(true);
        try {
            await this.bookingSvc.cancelBooking(b.id, this.cancelReason);
            this.booking.update(bk => bk ? { ...bk, status: 'cancelada' as BookingStatus, cancellation_reason: this.cancelReason, cancelled_at: new Date().toISOString() } : bk);
            this.showCancelModal.set(false);
            this.toast.success('Reserva cancelada');
        } catch (e: unknown) {
            this.cancelError.set((e as Error).message);
        } finally { this.actionLoading.set(false); }
    }

    async sendReminder() {
        const b = this.booking();
        if (!b) return;
        this.reminderLoading.set(true);
        try {
            await this.reminderSvc.sendReminder(b.id);
            this.booking.update(bk => bk ? { ...bk, reminder_sent_at: new Date().toISOString() } : bk);
            this.toast.success('📱 Recordatorio enviado por WhatsApp');
        } catch (e: unknown) {
            this.toast.error('Error al enviar el recordatorio: ' + (e as Error).message);
        } finally { this.reminderLoading.set(false); }
    }

    exportParticipants() {
        const b = this.booking();
        if (b) this.bookingSvc.exportParticipantsCsv(b);
    }
}
