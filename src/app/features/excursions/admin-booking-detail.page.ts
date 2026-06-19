import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { BookingDetail, BookingStatus } from '../../core/supabase/database.types';

@Component({
  selector: 'app-admin-booking-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      [title]="booking() ? ('Reserva ' + (booking()!.booking_number ?? '')) : 'Cargando...'"
      subtitle="Detalle de reserva">
      <button class="btn-secondary" (click)="router.navigate(['/excursions'], {queryParams: {tab: 'reservas'}})">← Volver</button>
    </app-page-header>

    @if (loading()) {
      <div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    } @else if (!booking()) {
      <div class="py-24 text-center text-gray-400">
        <p class="text-3xl mb-2">🎫</p><p>Reserva no encontrada</p>
      </div>
    } @else {
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main info -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Booking card -->
          <div class="card p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <p class="text-xs text-gray-400 uppercase font-semibold mb-0.5">Número de reserva</p>
                <p class="text-2xl font-bold font-mono text-gray-800">{{ booking()!.booking_number ?? booking()!.id.slice(0,8) }}</p>
              </div>
              <app-status-badge [status]="booking()!.status" type="booking" />
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Excursión</p>
                <p class="font-medium text-gray-800">{{ booking()!.excursion_name }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Operador</p>
                <p class="font-medium text-gray-800">{{ booking()!.operator_name }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Fecha de excursión</p>
                <p class="font-medium text-gray-800">{{ booking()!.excursion_date_str }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Hora de salida</p>
                <p class="font-medium text-gray-800">{{ booking()!.excursion_date?.departure_time ?? '—' }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Cliente</p>
                <p class="font-medium text-gray-800">{{ booking()!.customer_name }}</p>
                <p class="text-xs text-gray-400">{{ booking()!.customer?.phone ?? '—' }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Personas</p>
                <p class="font-medium text-gray-800">{{ booking()!.num_people }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Método de pago</p>
                <p class="font-medium text-gray-800">{{ booking()!.payment_method ?? '—' }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs mb-0.5">Fecha de reserva</p>
                <p class="font-medium text-gray-800">{{ booking()!.created_at | date:'dd/MM/yyyy HH:mm' }}</p>
              </div>
            </div>
            @if (booking()!.special_requests) {
              <div class="mt-4 p-3 bg-gray-50 rounded-lg">
                <p class="text-xs text-gray-400 mb-0.5">Solicitudes especiales</p>
                <p class="text-sm text-gray-600">{{ booking()!.special_requests }}</p>
              </div>
            }
            @if (booking()!.cancellation_reason) {
              <div class="mt-4 p-3 bg-error-50 rounded-lg border border-error-100">
                <p class="text-xs text-error-500 mb-0.5">Razón de cancelación</p>
                <p class="text-sm text-error-700">{{ booking()!.cancellation_reason }}</p>
                <p class="text-xs text-gray-400 mt-1">Cancelado por: {{ booking()!.cancelled_by ?? '—' }}</p>
              </div>
            }
          </div>

          <!-- Participants -->
          <div class="card p-0 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100">
              <h3 class="font-semibold text-gray-800">Participantes ({{ booking()!.participants?.length ?? 0 }})</h3>
            </div>
            @if (!booking()!.participants?.length) {
              <p class="px-6 py-8 text-center text-gray-400 text-sm">Sin participantes registrados</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">#</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">Nombre</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">Cédula/ID</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (p of booking()!.participants; track p.id; let i = $index) {
                      <tr>
                        <td class="px-4 py-3 text-xs text-gray-400">{{ i + 1 }}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ p.full_name }}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{{ p.cedula ?? '—' }}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{{ p.phone ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>

        <!-- Right panel -->
        <div class="space-y-6">
          <!-- Payment summary -->
          <div class="card p-5">
            <h3 class="font-semibold text-gray-800 mb-3">Resumen de pago</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-gray-500">Personas</span><span>{{ booking()!.num_people }}</span></div>
              <div class="flex justify-between border-t border-gray-100 pt-2 mt-2">
                <span class="font-semibold text-gray-800">Total</span>
                <span class="text-xl font-bold text-gray-800">RD$ {{ booking()!.total }}</span>
              </div>
            </div>
          </div>

          <!-- Refund info -->
          @if (booking()!.refund_eligible != null) {
            <div class="card p-5">
              <h3 class="font-semibold text-gray-800 mb-3">Reembolso</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">Elegible</span>
                  <span [class]="booking()!.refund_eligible ? 'text-success-600 font-medium' : 'text-gray-500'">{{ booking()!.refund_eligible ? 'Sí' : 'No' }}</span>
                </div>
                @if (booking()!.refund_amount != null) {
                  <div class="flex justify-between"><span class="text-gray-500">Monto</span><span>RD$ {{ booking()!.refund_amount }}</span></div>
                }
                <div class="flex justify-between">
                  <span class="text-gray-500">Procesado</span>
                  <span [class]="booking()!.refund_processed ? 'text-success-600 font-medium' : 'text-warning-600'">{{ booking()!.refund_processed ? '✓ Sí' : 'Pendiente' }}</span>
                </div>
              </div>
              @if (booking()!.refund_eligible && !booking()!.refund_processed) {
                <button class="mt-3 w-full btn-secondary text-sm" [disabled]="actionLoading()" (click)="markRefundProcessed()">
                  {{ actionLoading() ? 'Procesando...' : 'Marcar reembolso procesado' }}
                </button>
              }
            </div>
          }

          <!-- Actions -->
          <div class="card p-5">
            <h3 class="font-semibold text-gray-800 mb-3">Acciones</h3>
            <div class="space-y-2">
              @if (booking()!.status === 'pendiente') {
                <button class="w-full btn-primary text-sm" [disabled]="actionLoading()" (click)="updateStatus('confirmada')">✓ Confirmar reserva</button>
                <button class="w-full btn-danger text-sm" [disabled]="actionLoading()" (click)="showCancelModal.set(true)">✗ Cancelar reserva</button>
              }
              @if (booking()!.status === 'confirmada') {
                <button class="w-full btn-secondary text-sm" [disabled]="actionLoading()" (click)="updateStatus('completada')">🏁 Marcar completada</button>
                <button class="w-full btn-danger text-sm" [disabled]="actionLoading()" (click)="showCancelModal.set(true)">✗ Cancelar reserva</button>
              }
              @if (booking()!.status === 'cancelada' || booking()!.status === 'completada') {
                <p class="text-xs text-center text-gray-400 py-2">No hay acciones disponibles para este estado</p>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Cancel Modal -->
    @if (showCancelModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showCancelModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-2">Cancelar reserva</h3>
          <p class="text-sm text-gray-500 mb-4">Esta acción cancela la reserva. El sistema actualizará los cupos automáticamente.</p>
          <div class="mb-4">
            <label class="label">Razón de cancelación *</label>
            <textarea class="input-field resize-none" rows="3" [(ngModel)]="cancelReason" placeholder="Explica la razón de la cancelación..."></textarea>
          </div>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="showCancelModal.set(false)">Cancelar</button>
            <button class="btn-danger" [disabled]="!cancelReason.trim() || actionLoading()" (click)="executeCancel()">
              {{ actionLoading() ? 'Procesando...' : 'Confirmar cancelación' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminBookingDetailPageComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);

  readonly booking = signal<BookingDetail | null>(null);
  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly showCancelModal = signal(false);
  cancelReason = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.service.getBookingById(id).subscribe({
      next: b => { this.booking.set(b); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar la reserva'); this.loading.set(false); },
    });
  }

  async updateStatus(status: BookingStatus): Promise<void> {
    if (!this.booking()) return;
    this.actionLoading.set(true);
    try {
      await this.service.updateBookingStatus(this.booking()!.id, status);
      this.booking.update(b => b ? { ...b, status } : b);
      this.toastService.success('Estado actualizado');
    } catch { this.toastService.error('Error al actualizar'); }
    finally { this.actionLoading.set(false); }
  }

  async executeCancel(): Promise<void> {
    if (!this.cancelReason.trim() || !this.booking()) return;
    this.actionLoading.set(true);
    try {
      await this.service.updateBookingStatus(this.booking()!.id, 'cancelada', { cancellation_reason: this.cancelReason });
      this.booking.update(b => b ? { ...b, status: 'cancelada', cancellation_reason: this.cancelReason } : b);
      this.toastService.success('Reserva cancelada');
      this.showCancelModal.set(false);
    } catch { this.toastService.error('Error al cancelar'); }
    finally { this.actionLoading.set(false); }
  }

  async markRefundProcessed(): Promise<void> {
    if (!this.booking()) return;
    this.actionLoading.set(true);
    try {
      await this.service.updateBookingRefund(this.booking()!.id, true);
      this.booking.update(b => b ? { ...b, refund_processed: true } : b);
      this.toastService.success('Reembolso marcado como procesado');
    } catch { this.toastService.error('Error al actualizar'); }
    finally { this.actionLoading.set(false); }
  }
}
