import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CouriersService } from './couriers.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { Courier, VehicleType, DriverStats } from '../../core/supabase/database.types';
import { AuthService } from '../../core/auth/auth.service';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
  selector: 'app-couriers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, StatCardComponent, StatusBadgeComponent, AdminEmptyStateComponent],
  template: `
    <app-page-header title="Repartidores" subtitle="Gestión del equipo de entrega">
      <button class="btn-primary" (click)="openForm()">+ Repartidor</button>
    </app-page-header>

    <!-- Stats -->
    @if (stats()) {
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <app-stat-card title="Total" [value]="stats()!.total" icon="🛵" color="blue" />
        <app-stat-card title="Pendientes" [value]="stats()!.pending" icon="⏳" color="yellow" />
        <app-stat-card title="Disponibles" [value]="stats()!.available" icon="🟢" color="green" [pulse]="true" />
        <app-stat-card title="Documentos faltantes" [value]="stats()!.missingDocs" icon="📄" color="red" />
        <app-stat-card title="Rating promedio" [value]="stats()!.avgRating.toFixed(1)" icon="⭐" color="purple" />
      </div>
    } @else if (statsLoading()) {
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        @for (i of [1,2,3,4,5]; track i) {
          <div class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24"></div>
        }
      </div>
    }

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <input
        type="search"
        class="input-field flex-1"
        placeholder="Buscar por nombre, cédula, teléfono o placa..."
        [(ngModel)]="searchText"
      />
      <div class="flex gap-2 flex-wrap">
        <select class="input-field sm:w-44" [(ngModel)]="approvalFilter" (ngModelChange)="loadCouriers()">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
          <option value="suspendido">Suspendido</option>
        </select>
        <select class="input-field sm:w-44" [(ngModel)]="availableFilter" (ngModelChange)="loadCouriers()">
          <option value="">Disponibilidad</option>
          <option value="true">Disponibles</option>
          <option value="false">No disponibles</option>
        </select>
        <select class="input-field sm:w-40" [(ngModel)]="vehicleFilter" (ngModelChange)="loadCouriers()">
          <option value="">Todos los vehículos</option>
          <option value="moto">Moto</option>
          <option value="bicicleta">Bicicleta</option>
          <option value="carro">Carro</option>
          <option value="a_pie">A pie</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="admin-table-card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Repartidor</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cédula</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehículo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Disponible</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entregas</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ganancias</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8,9]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (filteredCouriers().length === 0) {
              <tr>
                <td colspan="9" class="px-4 py-6">
                  <app-admin-empty-state
                    icon="search"
                    [title]="couriers().length === 0 ? 'No hay repartidores registrados' : 'Sin repartidores que coincidan con los filtros'"
                    description="Ajusta los filtros o espera nuevos registros para ver resultados."
                    variant="soft" />
                </td>
              </tr>
            } @else {
              @for (r of filteredCouriers(); track r.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      @if (r.photo_url || r.avatar_url) {
                        <img [src]="r.photo_url ?? r.avatar_url" class="w-8 h-8 rounded-full object-cover" alt="" />
                      } @else {
                        <div class="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700">
                          {{ r.full_name?.charAt(0) ?? '?' }}
                        </div>
                      }
                      <div>
                        <p class="text-sm font-medium text-gray-800">{{ r.full_name }}</p>
                        <p class="text-xs text-gray-400">{{ r.phone }}</p>
                      </div>
                      @if (!r.photo_url || !r.cedula_photo_url || !r.vehicle_photo_url || !r.license_photo_url) {
                        <span class="text-warning-500 text-xs" title="Documentos faltantes">⚠️</span>
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ r.cedula ?? '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-gray-600">{{ vehicleLabel(r.vehicle_type!) }}</span>
                    @if (r.vehicle_plate) { <p class="text-xs text-gray-400">{{ r.vehicle_plate }}</p> }
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      [class]="r.is_available ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
                      {{ r.is_available ? '● Disponible' : '○ No disponible' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <app-status-badge [status]="r.approval_status ?? 'pendiente'" type="approval" />
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">⭐ {{ (r.avg_rating ?? 0).toFixed(1) }}</td>
                  <td class="px-4 py-3 text-sm text-gray-700">{{ r.total_deliveries ?? 0 }}</td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-700">RD$ {{ (r.total_earnings ?? 0).toFixed(0) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="router.navigate(['/couriers', r.id])">Ver</button>
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(r)">Editar</button>
                      @if (r.approval_status === 'pendiente') {
                        <button class="px-2 py-1 text-xs rounded-lg bg-success-50 text-success-700 hover:bg-success-100 transition-colors" (click)="confirmApprove(r)">✓ Aprobar</button>
                        <button class="px-2 py-1 text-xs rounded-lg bg-error-50 text-error-700 hover:bg-error-100 transition-colors" (click)="confirmReject(r)">✗ Rechazar</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Form modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-4">
            {{ editingId() ? 'Editar repartidor' : 'Nuevo repartidor' }}
          </h3>
          <form [formGroup]="courierForm" (ngSubmit)="save()" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Cédula *</label>
                <input class="input-field" formControlName="cedula" placeholder="001-1234567-8" />
              </div>
              <div>
                <label class="label">Tipo vehículo *</label>
                <select class="input-field" formControlName="vehicle_type">
                  <option value="moto">Moto</option>
                  <option value="bicicleta">Bicicleta</option>
                  <option value="carro">Carro</option>
                  <option value="a_pie">A pie</option>
                </select>
              </div>
              <div>
                <label class="label">Placa</label>
                <input class="input-field" formControlName="vehicle_plate" placeholder="A123456" />
              </div>
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="courierForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Confirm Approve Modal -->
    @if (confirmAction()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="confirmAction.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-2">{{ confirmTitle() }}</h3>
          <p class="text-sm text-gray-500 mb-4">{{ confirmMessage() }}</p>
          @if (confirmAction() === 'reject' || confirmAction() === 'suspend') {
            <div class="mb-4">
              <label class="label">Razón (opcional)</label>
              <textarea class="input-field resize-none" rows="2" [(ngModel)]="actionReason"></textarea>
            </div>
          }
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="confirmAction.set(null)">Cancelar</button>
            <button [class]="confirmAction() === 'approve' ? 'btn-primary' : 'btn-danger'"
              [disabled]="actionLoading()"
              (click)="executeAction()">
              {{ actionLoading() ? 'Procesando...' : confirmAction() === 'approve' ? 'Aprobar' : confirmAction() === 'reject' ? 'Rechazar' : 'Suspender' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CouriersPageComponent implements OnInit {
  private readonly service = inject(CouriersService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);

  readonly couriers = signal<Courier[]>([]);
  readonly loading = signal(true);
  readonly stats = signal<DriverStats | null>(null);
  readonly statsLoading = signal(true);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saveLoading = signal(false);
  readonly confirmAction = signal<'approve' | 'reject' | 'suspend' | null>(null);
  readonly actionLoading = signal(false);

  approvalFilter = '';
  availableFilter = '';
  searchText = '';
  vehicleFilter = '';
  actionReason = '';
  private actionTargetId = '';

  readonly confirmTitle = () => {
    if (this.confirmAction() === 'approve') return 'Aprobar repartidor';
    if (this.confirmAction() === 'reject') return 'Rechazar repartidor';
    return 'Suspender repartidor';
  };
  readonly confirmMessage = () => {
    const name = this.couriers().find(c => c.id === this.actionTargetId)?.full_name ?? 'este repartidor';
    if (this.confirmAction() === 'approve') return `¿Aprobar a ${name}? Se habilitará su acceso a la plataforma.`;
    if (this.confirmAction() === 'reject') return `¿Rechazar a ${name}? Esta acción cambia su estado a rechazado.`;
    return `¿Suspender a ${name}?`;
  };

  readonly filteredCouriers = () => {
    let result = this.couriers();
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(r =>
        r.full_name?.toLowerCase().includes(q) ||
        r.cedula?.includes(q) ||
        r.phone?.includes(q) ||
        r.vehicle_plate?.toLowerCase().includes(q)
      );
    }
    if (this.vehicleFilter) result = result.filter(r => r.vehicle_type === this.vehicleFilter);
    return result;
  };

  readonly courierForm = this.fb.group({
    cedula: ['', Validators.required],
    vehicle_type: ['moto' as VehicleType, Validators.required],
    vehicle_plate: [''],
  });

  ngOnInit(): void {
    this.loadCouriers();
    this.loadStats();
  }

  loadCouriers(): void {
    this.loading.set(true);
    const filters: any = {};
    if (this.availableFilter !== '') filters.available = this.availableFilter === 'true';
    if (this.approvalFilter) filters.approvalStatus = this.approvalFilter;
    if (this.vehicleFilter) filters.vehicleType = this.vehicleFilter;
    this.service.getCouriers(filters).subscribe({
      next: list => { this.couriers.set(list); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar repartidores'); this.loading.set(false); },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.service.getDriverStats().subscribe({
      next: s => { this.stats.set(s); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });
  }

  openForm(r?: Courier): void {
    this.editingId.set(r?.id ?? null);
    if (r) { this.courierForm.patchValue(r as any); }
    else { this.courierForm.reset({ vehicle_type: 'moto' }); }
    this.showForm.set(true);
  }

  confirmApprove(r: Courier): void {
    this.actionTargetId = r.id;
    this.actionReason = '';
    this.confirmAction.set('approve');
  }

  confirmReject(r: Courier): void {
    this.actionTargetId = r.id;
    this.actionReason = '';
    this.confirmAction.set('reject');
  }

  async executeAction(): Promise<void> {
    const action = this.confirmAction();
    if (!action || !this.actionTargetId) return;
    this.actionLoading.set(true);
    try {
      if (action === 'approve') {
        await this.service.approveDriver(this.actionTargetId, this.authService.currentUser()?.id ?? '');
        this.toastService.success('Repartidor aprobado');
      } else if (action === 'reject') {
        await this.service.rejectDriver(this.actionTargetId, this.actionReason || undefined);
        this.toastService.success('Repartidor rechazado');
      } else {
        await this.service.suspendDriver(this.actionTargetId, this.actionReason || undefined);
        this.toastService.success('Repartidor suspendido');
      }
      this.confirmAction.set(null);
      this.loadCouriers();
      this.loadStats();
    } catch {
      this.toastService.error('Error al procesar la acción');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.courierForm.invalid) return;
    this.saveLoading.set(true);
    const val = this.courierForm.getRawValue();
    try {
      await this.service.saveCourier({
        ...(this.editingId() ? { id: this.editingId()! } : {}),
        cedula: val.cedula!,
        vehicle_type: val.vehicle_type as VehicleType,
        vehicle_plate: val.vehicle_plate ?? null,
        is_available: true,
      });
      this.toastService.success('Repartidor guardado');
      this.showForm.set(false);
      this.loadCouriers();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.saveLoading.set(false); }
  }

  vehicleLabel(type: VehicleType): string {
    const map: Record<VehicleType, string> = {
      moto: '🏍️ Moto', bicicleta: '🚲 Bicicleta', carro: '🚗 Carro', a_pie: '🚶 A pie',
    };
    return map[type] ?? type;
  }
}
