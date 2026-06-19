import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { ExcursionOperator, ExcursionOperatorAdmin } from '../../core/supabase/database.types';

type OperatorTab = 'overview' | 'excursions' | 'admins' | 'bookings';

@Component({
  selector: 'app-admin-operator-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      [title]="operator()?.name ?? 'Operador'"
      subtitle="Detalle del operador turístico">
      <button class="btn-secondary" (click)="router.navigate(['/excursions'])">← Volver</button>
    </app-page-header>

    @if (loading()) {
      <div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    } @else if (!operator()) {
      <div class="py-24 text-center text-gray-400">
        <p class="text-3xl mb-2">🏢</p><p>Operador no encontrado</p>
      </div>
    } @else {
      <!-- Header -->
      <div class="card p-5 mb-6 flex flex-col sm:flex-row items-start gap-5">
        @if (operator()!.logo_url) {
          <img [src]="operator()!.logo_url" class="w-20 h-20 rounded-xl object-contain border border-gray-200 bg-gray-50" alt="" />
        } @else {
          <div class="w-20 h-20 rounded-xl bg-brand-50 flex items-center justify-center text-3xl font-bold text-brand-600">
            {{ operator()!.name.charAt(0) }}
          </div>
        }
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="text-xl font-bold text-gray-800">{{ operator()!.name }}</h2>
            <app-status-badge [status]="operator()!.approval_status ?? 'pendiente'" type="approval" />
            @if (operator()!.is_active) {
              <span class="text-xs px-2 py-0.5 rounded-full bg-success-50 text-success-700">Activo</span>
            }
          </div>
          <p class="text-sm text-gray-500 mt-1">{{ operator()!.category ?? 'Sin categoría' }}</p>
          @if (operator()!.description) {
            <p class="text-sm text-gray-600 mt-1 line-clamp-2">{{ operator()!.description }}</p>
          }
          <div class="flex gap-4 mt-2 text-sm text-gray-500">
            <span>⭐ {{ (operator()!.avg_rating ?? 0).toFixed(1) }} ({{ operator()!.total_reviews }} reseñas)</span>
            @if (operator()!.whatsapp_number) { <span>📱 {{ operator()!.whatsapp_number }}</span> }
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          @if (operator()!.approval_status === 'pendiente') {
            <button class="px-4 py-2 text-sm rounded-lg bg-success-600 text-white hover:bg-success-700 font-medium" [disabled]="actionLoading()" (click)="approve()">✓ Aprobar</button>
            <button class="px-4 py-2 text-sm rounded-lg bg-error-600 text-white hover:bg-error-700 font-medium" [disabled]="actionLoading()" (click)="showRejectModal.set(true)">✗ Rechazar</button>
          }
        </div>
      </div>

      <!-- Approval banner -->
      @if (operator()!.approval_status === 'pendiente') {
        <div class="card p-4 mb-6 bg-warning-50 border-warning-200">
          <p class="font-medium text-warning-800">⏳ Operador pendiente de aprobación</p>
          <p class="text-sm text-warning-600 mt-0.5">Revisa la información antes de aprobar.</p>
        </div>
      }

      <!-- Tabs -->
      <div class="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        @for (tab of tabs; track tab.key) {
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            [class]="activeTab() === tab.key ? 'bg-white text-gray-800 shadow-theme-xs' : 'text-gray-500 hover:text-gray-700'"
            (click)="setTab(tab.key)">{{ tab.label }}</button>
        }
      </div>

      <!-- TAB: Overview -->
      @if (activeTab() === 'overview') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-5 space-y-4">
            <h3 class="font-semibold text-gray-800">Información básica</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-gray-500">Nombre</dt><dd class="font-medium text-gray-800">{{ operator()!.name }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Slug</dt><dd class="text-gray-700 font-mono text-xs">{{ operator()!.slug }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Categoría</dt><dd class="font-medium text-gray-800">{{ operator()!.category ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Dirección</dt><dd class="font-medium text-gray-800">{{ operator()!.address ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">WhatsApp</dt><dd class="font-medium text-gray-800">{{ operator()!.whatsapp_number ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Años de exp.</dt><dd class="font-medium text-gray-800">{{ operator()!.years_experience ?? '—' }}</dd></div>
            </dl>
          </div>
          <div class="card p-5 space-y-4">
            <h3 class="font-semibold text-gray-800">Configuración de comisión</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-gray-500">Tipo de comisión</dt><dd class="font-medium text-gray-800">{{ operator()!.management_fee_type ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Valor</dt><dd class="font-medium text-gray-800">{{ operator()!.management_fee_value != null ? (operator()!.management_fee_type === 'percentage' ? operator()!.management_fee_value + '%' : 'RD$ ' + operator()!.management_fee_value) : '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Licencia turismo</dt><dd class="font-medium text-gray-800">{{ operator()!.has_tourism_license ? '✓ ' + (operator()!.tourism_license_number ?? '') : 'No' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Seguro</dt><dd class="font-medium text-gray-800">{{ operator()!.has_insurance ? '✓ Sí' : 'No' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Idiomas</dt><dd class="font-medium text-gray-800">{{ operator()!.languages?.join(', ') || '—' }}</dd></div>
            </dl>
          </div>
          @if (operator()!.description) {
            <div class="card p-5 lg:col-span-2">
              <h3 class="font-semibold text-gray-800 mb-2">Descripción</h3>
              <p class="text-sm text-gray-600">{{ operator()!.description }}</p>
            </div>
          }
        </div>
      }

      <!-- TAB: Excursions -->
      @if (activeTab() === 'excursions') {
        @if (excursionsLoading()) {
          <div class="animate-pulse h-40 bg-gray-200 rounded-xl"></div>
        } @else if (excursions().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">🏔️</p><p class="text-sm">Sin excursiones registradas</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Precio/persona</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duración</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dificultad</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (e of excursions(); track e.id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ e.name }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700">RD$ {{ e.price_per_person }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ e.duration_hours ?? '—' }} h</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ e.difficulty_level ?? '—' }}</td>
                    <td class="px-4 py-3">
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium" [class]="e.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">{{ e.is_active ? 'Activa' : 'Inactiva' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- TAB: Admins -->
      @if (activeTab() === 'admins') {
        <div class="flex justify-end mb-4">
          <button class="btn-primary text-sm" (click)="showAddAdminModal.set(true)">+ Agregar admin</button>
        </div>
        @if (adminsLoading()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded-xl"></div>
        } @else if (admins().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">👤</p><p class="text-sm">Sin administradores asignados</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teléfono</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (a of admins(); track a.id) {
                  <tr>
                    <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ a.full_name }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ a.email }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ a.phone ?? '—' }}</td>
                    <td class="px-4 py-3">
                      <button class="text-xs text-error-500 hover:text-error-700" (click)="removeAdmin(a.id)">Eliminar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (showAddAdminModal()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/50" (click)="showAddAdminModal.set(false)"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
              <h3 class="font-semibold text-gray-800 mb-4">Agregar administrador</h3>
              <div>
                <label class="label">User ID *</label>
                <input class="input-field" [(ngModel)]="newAdminUserId" placeholder="UUID del usuario" />
              </div>
              <div class="flex gap-3 justify-end mt-4">
                <button class="btn-secondary" (click)="showAddAdminModal.set(false)">Cancelar</button>
                <button class="btn-primary" [disabled]="!newAdminUserId || formLoading()" (click)="addAdmin()">
                  {{ formLoading() ? 'Guardando...' : 'Agregar' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- TAB: Bookings -->
      @if (activeTab() === 'bookings') {
        @if (bookingsLoading()) {
          <div class="animate-pulse h-40 bg-gray-200 rounded-xl"></div>
        } @else if (bookings().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">🎫</p><p class="text-sm">Sin reservas para este operador</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"># Reserva</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Excursión</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (b of bookings(); track b.id) {
                  <tr class="hover:bg-gray-50 cursor-pointer" (click)="router.navigate(['/excursions/bookings', b.id])">
                    <td class="px-4 py-3 text-sm font-mono text-gray-800">{{ b.booking_number ?? b.id.slice(0,8) }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ b.excursion_name }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ b.customer_name }}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">{{ b.excursion_date_str }}</td>
                    <td class="px-4 py-3 text-sm font-medium text-gray-700">RD$ {{ b.total }}</td>
                    <td class="px-4 py-3"><app-status-badge [status]="b.status" type="booking" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    }

    <!-- Reject modal -->
    @if (showRejectModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showRejectModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-2">Rechazar operador</h3>
          <p class="text-sm text-gray-500 mb-4">¿Estás seguro de rechazar a {{ operator()?.name }}?</p>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="showRejectModal.set(false)">Cancelar</button>
            <button class="btn-danger" [disabled]="actionLoading()" (click)="reject()">
              {{ actionLoading() ? 'Procesando...' : 'Rechazar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminOperatorDetailPageComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);

  readonly operator = signal<ExcursionOperator | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal<OperatorTab>('overview');
  readonly actionLoading = signal(false);
  readonly showRejectModal = signal(false);
  readonly formLoading = signal(false);
  readonly showAddAdminModal = signal(false);

  readonly excursions = signal<any[]>([]);
  readonly excursionsLoading = signal(false);
  readonly admins = signal<ExcursionOperatorAdmin[]>([]);
  readonly adminsLoading = signal(false);
  readonly bookings = signal<any[]>([]);
  readonly bookingsLoading = signal(false);

  newAdminUserId = '';
  private operatorId = '';

  readonly tabs = [
    { key: 'overview' as OperatorTab, label: 'Resumen' },
    { key: 'excursions' as OperatorTab, label: 'Excursiones' },
    { key: 'admins' as OperatorTab, label: 'Administradores' },
    { key: 'bookings' as OperatorTab, label: 'Reservas' },
  ];

  ngOnInit(): void {
    this.operatorId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadOperator();
  }

  loadOperator(): void {
    this.loading.set(true);
    this.service.getOperatorById(this.operatorId).subscribe({
      next: op => { this.operator.set(op); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar el operador'); this.loading.set(false); },
    });
  }

  setTab(tab: OperatorTab): void {
    this.activeTab.set(tab);
    if (tab === 'excursions' && this.excursions().length === 0) this.loadExcursions();
    if (tab === 'admins' && this.admins().length === 0) this.loadAdmins();
    if (tab === 'bookings' && this.bookings().length === 0) this.loadBookings();
  }

  loadExcursions(): void {
    this.excursionsLoading.set(true);
    this.service.getExcursions({ operatorId: this.operatorId }).subscribe(data => { this.excursions.set(data); this.excursionsLoading.set(false); });
  }

  loadAdmins(): void {
    this.adminsLoading.set(true);
    this.service.listOperatorAdmins(this.operatorId).subscribe(data => { this.admins.set(data); this.adminsLoading.set(false); });
  }

  loadBookings(): void {
    this.bookingsLoading.set(true);
    this.service.getBookings({ operatorId: this.operatorId }).subscribe(data => { this.bookings.set(data); this.bookingsLoading.set(false); });
  }

  async approve(): Promise<void> {
    this.actionLoading.set(true);
    try {
      await this.service.approveOperator(this.operatorId);
      this.toastService.success('Operador aprobado');
      this.loadOperator();
    } catch { this.toastService.error('Error al aprobar'); }
    finally { this.actionLoading.set(false); }
  }

  async reject(): Promise<void> {
    this.actionLoading.set(true);
    try {
      await this.service.rejectOperator(this.operatorId);
      this.toastService.success('Operador rechazado');
      this.showRejectModal.set(false);
      this.loadOperator();
    } catch { this.toastService.error('Error al rechazar'); }
    finally { this.actionLoading.set(false); }
  }

  async addAdmin(): Promise<void> {
    this.formLoading.set(true);
    try {
      await this.service.addOperatorAdmin(this.operatorId, this.newAdminUserId);
      this.toastService.success('Administrador agregado');
      this.showAddAdminModal.set(false);
      this.newAdminUserId = '';
      this.admins.set([]);
      this.loadAdmins();
    } catch { this.toastService.error('Error al agregar'); }
    finally { this.formLoading.set(false); }
  }

  async removeAdmin(id: string): Promise<void> {
    try {
      await this.service.removeOperatorAdmin(id);
      this.toastService.success('Administrador eliminado');
      this.admins.update(list => list.filter(a => a.id !== id));
    } catch { this.toastService.error('Error al eliminar'); }
  }
}
