import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RestaurantsService } from './restaurants.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { DeliveryZone, Restaurant } from '../../core/supabase/database.types';
import { TuttyMapComponent } from '../../shared/ui/map/tutty-map.component';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
    selector: 'app-delivery-zones-page',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, TuttyMapComponent, AdminEmptyStateComponent],
    template: `
    <app-page-header
      [title]="'Zonas de Entrega' + (restaurant() ? ' — ' + restaurant()!.name : '')"
      subtitle="Configura las zonas y tarifas de delivery">
      <button class="btn-secondary" (click)="router.navigate(['/restaurants'])">← Volver</button>
      <button class="btn-primary" (click)="openForm()">+ Nueva Zona</button>
    </app-page-header>

    <!-- Coverage summary -->
    @if (zones().length > 0) {
      <div class="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-5 py-4 flex flex-wrap gap-6">
        <div>
          <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Zonas activas</p>
          <p class="text-2xl font-bold text-brand-700">{{ activeZones() }}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Fee mínimo</p>
          <p class="text-2xl font-bold text-brand-700">RD$ {{ minFee() }}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Radio máximo</p>
          <p class="text-2xl font-bold text-brand-700">{{ maxRadius() ?? '—' }} km</p>
        </div>
      </div>
    }

    <!-- No coordinates warning -->
    @if (restaurant() && !restaurant()!.lat && !restaurant()!.lng) {
      <div class="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <span class="text-lg flex-shrink-0">⚠️</span>
        <div>
          <p class="font-medium">Comercio sin coordenadas</p>
          <p class="text-xs mt-0.5">El cálculo de cobertura y distancia no funcionará hasta que el comercio configure su ubicación.</p>
        </div>
      </div>
    }

    <!-- Coverage map -->
    @if (restaurant()?.lat && restaurant()?.lng) {
      <div class="mb-4 bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p class="text-sm font-semibold text-gray-800">Mapa de cobertura</p>
          <p class="text-xs text-gray-400">Radio de la zona activa de mayor prioridad</p>
        </div>
        <app-tutty-map
          mode="radius"
          [lat]="restaurant()!.lat"
          [lng]="restaurant()!.lng"
          [radiusKm]="mapRadiusKm()"
          height="280px"
          mapClass=""
        />
      </div>
    }

    <!-- Table -->
    <div class="admin-table-card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Zona</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sectores</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tarifa</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mín. Pedido</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tiempo est.</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Radio máx.</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (zones().length === 0) {
              <tr>
                <td colspan="8" class="px-4 py-6">
                  <app-admin-empty-state
                    icon="map"
                    title="Sin zonas de entrega configuradas"
                    description="Crea una zona para habilitar cobertura de delivery."
                    variant="soft" />
                </td>
              </tr>
            } @else {
              @for (zone of zones(); track zone.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-gray-800">{{ zone.name }}</p>
                    <p class="text-xs text-gray-400">Prioridad {{ zone.priority }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1 max-w-xs">
                      @for (sector of zone.sector_list; track sector) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{{ sector }}</span>
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-700">RD$ {{ zone.delivery_fee }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">RD$ {{ zone.min_order }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ zone.estimated_time }} min</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ zone.max_distance_km ?? '—' }} km</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      [class]="zone.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
                      {{ zone.is_active ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-2">
                      <button class="text-brand-500 hover:text-brand-700 text-sm font-medium" (click)="openForm(zone)">Editar</button>
                      <button class="text-error-500 hover:text-error-700 text-sm font-medium" (click)="deleteZone(zone)">Eliminar</button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Zone Form Modal -->
    @if (showModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="closeModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold text-gray-800">{{ editingZone() ? 'Editar zona' : 'Nueva zona' }}</h3>
            <button aria-label="Cerrar modal de zona" class="text-gray-400 hover:text-gray-600" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="zoneForm" (ngSubmit)="saveZone()" class="p-6 space-y-5">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="label">Nombre de la zona *</label>
                <input class="input-field" formControlName="name" placeholder="Ej: Zona Norte" />
              </div>

              <!-- Sector tag input -->
              <div class="col-span-2">
                <label class="label">Sectores</label>
                <div class="border border-gray-300 rounded-lg px-3 py-2 flex flex-wrap gap-2 min-h-[44px] focus-within:ring-2 focus-within:ring-brand-500">
                  @for (s of sectors; track s) {
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-sm">
                      {{ s }}
                      <button type="button" (click)="removeSector(s)" class="ml-1 text-brand-400 hover:text-brand-600" [attr.aria-label]="'Quitar sector ' + s">×</button>
                    </span>
                  }
                  <input
                    #sectorInput
                    type="text"
                    class="outline-none text-sm flex-1 min-w-[120px]"
                    placeholder="Agregar sector y presionar Enter..."
                    (keydown.enter)="addSector(sectorInput); $event.preventDefault()"
                    (keydown.comma)="addSector(sectorInput); $event.preventDefault()"
                  />
                </div>
                <p class="text-xs text-gray-400 mt-1">Presiona Enter o coma para agregar</p>
              </div>

              <div>
                <label class="label">Tarifa de entrega (RD$) *</label>
                <input class="input-field" type="number" min="0" formControlName="delivery_fee" />
              </div>
              <div>
                <label class="label">Monto mínimo de pedido (RD$)</label>
                <input class="input-field" type="number" min="0" formControlName="min_order" />
              </div>
              <div>
                <label class="label">Tiempo estimado (min)</label>
                <input class="input-field" type="number" min="0" formControlName="estimated_time" />
              </div>
              <div>
                <label class="label">Radio máximo (km)</label>
                <input class="input-field" type="number" min="0" step="0.1" formControlName="max_distance_km" />
              </div>
              <div>
                <label class="label">Tarifa extra por km (RD$)</label>
                <input class="input-field" type="number" min="0" step="0.5" formControlName="extra_km_fee" />
              </div>
              <div>
                <label class="label">Prioridad</label>
                <input class="input-field" type="number" min="1" formControlName="priority" />
              </div>
              <div>
                <label class="label">Disponible desde</label>
                <input class="input-field" type="time" formControlName="available_from" />
              </div>
              <div>
                <label class="label">Disponible hasta</label>
                <input class="input-field" type="time" formControlName="available_until" />
              </div>
              <div class="col-span-2 flex items-center gap-3">
                <button type="button"
                  (click)="zoneForm.get('is_active')!.setValue(!zoneForm.get('is_active')!.value)"
                  [class]="zoneForm.get('is_active')!.value
                    ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors'
                    : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="zoneForm.get('is_active')!.value
                    ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'
                    : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
                <span class="text-sm text-gray-700">Zona activa</span>
              </div>
            </div>
            <div class="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="zoneForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar zona' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class DeliveryZonesPageComponent implements OnInit {
    readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly service = inject(RestaurantsService);
    private readonly toastService = inject(ToastService);
    private readonly confirmService = inject(ConfirmService);
    private readonly fb = inject(FormBuilder);

    readonly restaurant = signal<Restaurant | null>(null);
    readonly zones = signal<DeliveryZone[]>([]);
    readonly loading = signal(true);
    readonly showModal = signal(false);
    readonly editingZone = signal<DeliveryZone | null>(null);
    readonly saveLoading = signal(false);
    sectors: string[] = [];

    private commerceId = '';

    readonly activeZones = () => this.zones().filter(z => z.is_active).length;
    readonly minFee = () => {
        const fees = this.zones().filter(z => z.is_active).map(z => z.delivery_fee);
        return fees.length ? Math.min(...fees) : 0;
    };
    readonly maxRadius = () => {
        const radii = this.zones().map(z => z.max_distance_km).filter((v): v is number => v != null);
        return radii.length ? Math.max(...radii) : null;
    };
    readonly mapRadiusKm = () => {
        const active = this.zones().filter(z => z.is_active);
        const radii = active.map(z => z.max_distance_km).filter((v): v is number => v != null);
        return radii.length ? Math.max(...radii) : 3;
    };

    readonly zoneForm = this.fb.group({
        name: ['', Validators.required],
        delivery_fee: [0, [Validators.required, Validators.min(0)]],
        min_order: [0],
        estimated_time: [30],
        max_distance_km: [null as number | null],
        extra_km_fee: [0],
        priority: [1],
        available_from: [null as string | null],
        available_until: [null as string | null],
        is_active: [true],
    });

    ngOnInit(): void {
        this.commerceId = this.route.snapshot.paramMap.get('id') ?? '';
        this.loadRestaurant();
        this.loadZones();
    }

    loadRestaurant(): void {
        this.service.getRestaurantById(this.commerceId).subscribe(r => this.restaurant.set(r));
    }

    loadZones(): void {
        this.loading.set(true);
        this.service.getDeliveryZones(this.commerceId).subscribe(zones => {
            this.zones.set(zones);
            this.loading.set(false);
        });
    }

    openForm(zone?: DeliveryZone): void {
        this.editingZone.set(zone ?? null);
        this.zoneForm.reset({ delivery_fee: 0, min_order: 0, estimated_time: 30, priority: 1, is_active: true });
        this.sectors = [];
        if (zone) {
            this.zoneForm.patchValue(zone as any);
            this.sectors = [...(zone.sector_list ?? [])];
        }
        this.showModal.set(true);
    }

    closeModal(): void {
        this.showModal.set(false);
        this.editingZone.set(null);
        this.sectors = [];
    }

    addSector(input: HTMLInputElement): void {
        const val = input.value.trim().replace(/,/g, '');
        if (val && !this.sectors.includes(val)) {
            this.sectors = [...this.sectors, val];
        }
        input.value = '';
    }

    removeSector(sector: string): void {
        this.sectors = this.sectors.filter(s => s !== sector);
    }

    async saveZone(): Promise<void> {
        if (this.zoneForm.invalid) return;
        this.saveLoading.set(true);
        try {
            const val = this.zoneForm.getRawValue();
            await this.service.saveDeliveryZone({
                ...(this.editingZone() ? { id: this.editingZone()!.id } : {}),
                commerce_id: this.commerceId,
                name: val.name!,
                sector_list: this.sectors,
                delivery_fee: val.delivery_fee ?? 0,
                min_order: val.min_order ?? 0,
                estimated_time: val.estimated_time ?? 30,
                max_distance_km: val.max_distance_km ?? null,
                extra_km_fee: val.extra_km_fee ?? 0,
                priority: val.priority ?? 1,
                available_from: val.available_from ?? null,
                available_until: val.available_until ?? null,
                is_active: val.is_active ?? true,
            });
            this.toastService.success('Zona guardada');
            this.closeModal();
            this.loadZones();
        } catch {
            this.toastService.error('Error al guardar la zona');
        } finally {
            this.saveLoading.set(false);
        }
    }

    async deleteZone(zone: DeliveryZone): Promise<void> {
        const ok = await this.confirmService.confirm({
            title: `¿Eliminar zona "${zone.name}"?`,
            message: 'Esta acción no se puede deshacer.',
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!ok) return;
        try {
            await this.service.deleteDeliveryZone(zone.id);
            this.toastService.success('Zona eliminada');
            this.loadZones();
        } catch {
            this.toastService.error('Error al eliminar');
        }
    }
}
