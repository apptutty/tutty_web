import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RepartidoresService } from './repartidores.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { Repartidor, VehicleType } from '../../core/supabase/database.types';

@Component({
  selector: 'app-repartidores-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent],
  template: `
    <app-page-header title="Repartidores" subtitle="Gestión del equipo de entrega">
      <button class="btn-primary" (click)="openForm()">+ Repartidor</button>
    </app-page-header>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <input
        type="search"
        class="input-field max-w-xs"
        placeholder="Buscar por nombre o cédula..."
        [(ngModel)]="searchText"
      />
      <select class="input-field w-48" [(ngModel)]="availableFilter" (ngModelChange)="loadRepartidores()">
        <option value="">Todos</option>
        <option value="true">Disponibles</option>
        <option value="false">No disponibles</option>
      </select>
      <select class="input-field w-44" [(ngModel)]="vehicleFilter">
        <option value="">Todos los vehículos</option>
        <option value="moto">Moto</option>
        <option value="bicicleta">Bicicleta</option>
        <option value="carro">Carro</option>
        <option value="a_pie">A pie</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Repartidor</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cédula</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehículo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Disponible</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entregas</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ganancias</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3,4]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (repartidores().length === 0) {
              <tr>
                <td colspan="8" class="px-4 py-12 text-center text-gray-400">
                  <p class="text-3xl mb-2">🛵</p>
                  <p class="text-sm">Sin repartidores</p>
                </td>
              </tr>
            } @else {
              @for (r of filteredRepartidores(); track r.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                        {{ r.full_name?.charAt(0) ?? '?' }}
                      </div>
                      <div>
                        <p class="text-sm font-medium text-gray-800">{{ r.full_name }}</p>
                        <p class="text-xs text-gray-400">{{ r.phone }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ r.cedula }}</td>
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
                  <td class="px-4 py-3 text-sm text-gray-700">⭐ {{ r.avg_rating.toFixed(1) }}</td>
                  <td class="px-4 py-3 text-sm text-gray-700">{{ r.total_deliveries }}</td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-700">RD$ {{ r.total_earnings.toFixed(0) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(r)">Editar</button>
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="router.navigate(['/repartidores', r.id])">Ver</button>
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
          <form [formGroup]="repartidorForm" (ngSubmit)="save()" class="space-y-4">
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
              <button type="submit" class="btn-primary" [disabled]="repartidorForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class RepartidoresPageComponent implements OnInit {
  private readonly service = inject(RepartidoresService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);

  readonly repartidores = signal<Repartidor[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saveLoading = signal(false);

  availableFilter = '';
  searchText = '';
  vehicleFilter = '';

  readonly filteredRepartidores = () => {
    let result = this.repartidores();
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(r =>
        r.full_name?.toLowerCase().includes(q) ||
        r.cedula?.includes(q) ||
        r.phone?.includes(q)
      );
    }
    if (this.vehicleFilter) result = result.filter(r => r.vehicle_type === this.vehicleFilter);
    return result;
  };

  readonly repartidorForm = this.fb.group({
    user_id: [''],
    cedula: ['', Validators.required],
    vehicle_type: ['moto' as VehicleType, Validators.required],
    vehicle_plate: [''],
  });

  ngOnInit(): void { this.loadRepartidores(); }

  loadRepartidores(): void {
    this.loading.set(true);
    const filters = this.availableFilter !== '' ? { available: this.availableFilter === 'true' } : {};
    this.service.getRepartidores(filters).subscribe({
      next: list => { this.repartidores.set(list); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar repartidores'); this.loading.set(false); },
    });
  }

  openForm(r?: Repartidor): void {
    this.editingId.set(r?.id ?? null);
    if (r) { this.repartidorForm.patchValue(r as any); }
    else { this.repartidorForm.reset({ vehicle_type: 'moto' }); }
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (this.repartidorForm.invalid) return;
    this.saveLoading.set(true);
    const val = this.repartidorForm.getRawValue();
    try {
      await this.service.saveRepartidor({
        ...(this.editingId() ? { id: this.editingId()! } : {}),
        cedula: val.cedula!,
        vehicle_type: val.vehicle_type as VehicleType,
        vehicle_plate: val.vehicle_plate ?? null,
        is_available: true,
        avg_rating: 0,
        total_deliveries: 0,
        total_earnings: 0,
        zone_ids: [],
      });
      this.toastService.success('Repartidor guardado');
      this.showForm.set(false);
      this.loadRepartidores();
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
