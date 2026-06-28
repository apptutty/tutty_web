import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { StoreAdminService } from '../store-admin.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/modal/confirm.service';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { DeliveryZone } from '../../../core/supabase/database.types';
import { TuttyMapComponent } from '../../../shared/ui/map/tutty-map.component';
import { AdminPageHeaderComponent } from '../shared/admin-page-header.component';
import { AdminEmptyStateComponent } from '../shared/admin-empty-state.component';

@Component({
    selector: 'app-store-zones',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, TuttyMapComponent, AdminPageHeaderComponent, AdminEmptyStateComponent],
    template: `
    <div class="p-6 lg:p-8 space-y-6">
      <!-- Header -->
      <app-admin-page-header
        title="Delivery Zones"
        subtitle="Configure the areas and fees where you deliver."
      >
        <ng-container actions>
          <button class="btn-primary w-full sm:w-auto" (click)="openForm()">+ New Zone</button>
        </ng-container>
      </app-admin-page-header>

      <!-- Coverage summary -->
      @if (zones().length > 0) {
        <div class="bg-brand-50 border border-brand-200 rounded-xl px-5 py-4 flex flex-wrap gap-6">
          <div>
            <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Active Zones</p>
            <p class="text-2xl font-bold text-brand-700">{{ activeZones() }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Starting fee from</p>
            <p class="text-2xl font-bold text-brand-700">RD$ {{ minFee() }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Max radius covered</p>
            <p class="text-2xl font-bold text-brand-700">{{ maxRadius() ?? '—' }} km</p>
          </div>
        </div>
      }

      <!-- No location warning -->
      @if (!hasStoreCoords()) {
        <div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span class="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p class="font-medium">Comercio sin coordenadas configuradas</p>
            <p class="text-xs mt-0.5">El mapa de cobertura y el cálculo de delivery no funcionarán. Ve a <strong>Configuración → Perfil → Ubicación en mapa</strong> para configurarlas.</p>
          </div>
        </div>
      }

      <!-- Coverage map -->
      @if (storeLat() && storeLng()) {
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p class="text-sm font-semibold text-gray-800">Coverage Map</p>
            <p class="text-xs text-gray-400">Showing radius of highest-priority active zone</p>
          </div>
          <app-tutty-map
            mode="radius"
            [lat]="storeLat()"
            [lng]="storeLng()"
            [radiusKm]="mapRadiusKm()"
            height="300px"
            mapClass=""
          />
        </div>
      }

      <!-- Zones table -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        @if (loading()) {
          <div class="p-8 space-y-3">
            @for (i of [1,2,3]; track i) {
              <div class="h-14 bg-gray-100 rounded-lg animate-pulse"></div>
            }
          </div>
        } @else if (zones().length === 0) {
          <div class="py-16">
            <app-admin-empty-state
              icon="map"
              title="No delivery zones configured"
              description="Add zones to let customers know where you deliver."
              actionLabel="+ Add First Zone"
              (action)="openForm()" />
          </div>
        } @else {
          <!-- Mobile cards (hidden on md+) -->
          <div class="md:hidden divide-y divide-gray-100">
            @for (zone of zones(); track zone.id) {
              <div class="p-4 space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-gray-800">{{ zone.name }}</p>
                    <p class="text-xs text-gray-400">Prioridad {{ zone.priority }}</p>
                  </div>
                  <button
                    (click)="toggleActive(zone)"
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors"
                    [class]="zone.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
                    <span class="w-1.5 h-1.5 rounded-full mr-1.5"
                      [class]="zone.is_active ? 'bg-success-500' : 'bg-gray-400'"></span>
                    {{ zone.is_active ? 'Active' : 'Inactive' }}
                  </button>
                </div>
                <div class="grid grid-cols-3 gap-2 text-xs">
                  <div class="bg-gray-50 rounded-lg p-2 text-center">
                    <p class="text-gray-400">Fee</p>
                    <p class="font-semibold text-gray-800">RD$ {{ zone.delivery_fee }}</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-2 text-center">
                    <p class="text-gray-400">Min. pedido</p>
                    <p class="font-semibold text-gray-800">RD$ {{ zone.min_order }}</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-2 text-center">
                    <p class="text-gray-400">Radio</p>
                    <p class="font-semibold text-gray-800">{{ zone.max_distance_km ?? '—' }} km</p>
                  </div>
                </div>
                @if (zone.sector_list.length > 0) {
                  <div class="flex flex-wrap gap-1">
                    @for (sector of zone.sector_list; track sector) {
                      <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{{ sector }}</span>
                    }
                  </div>
                }
                <div class="flex gap-3 pt-1">
                  <button class="text-sm text-brand-500 font-medium" (click)="openForm(zone)">Editar</button>
                  <button class="text-sm text-error-500 font-medium" (click)="deleteZone(zone)">Eliminar</button>
                </div>
              </div>
            }
          </div>

          <!-- Desktop table (hidden below md) -->
          <div class="hidden md:block overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Zone</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sectors covered</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Min. order</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. time</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Max radius</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th class="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (zone of zones(); track zone.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-3.5">
                      <p class="text-sm font-semibold text-gray-800">{{ zone.name }}</p>
                      <p class="text-xs text-gray-400">Priority {{ zone.priority }}</p>
                    </td>
                    <td class="px-5 py-3.5 max-w-xs">
                      <div class="flex flex-wrap gap-1">
                        @for (sector of zone.sector_list; track sector) {
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{{ sector }}</span>
                        }
                        @if (zone.sector_list.length === 0) {
                          <span class="text-xs text-gray-400 italic">No sectors listed</span>
                        }
                      </div>
                    </td>
                    <td class="px-5 py-3.5 text-sm font-medium text-gray-700">RD$ {{ zone.delivery_fee }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-600">RD$ {{ zone.min_order }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-600">{{ zone.estimated_time }} min</td>
                    <td class="px-5 py-3.5 text-sm text-gray-600">{{ zone.max_distance_km ?? '—' }} km</td>
                    <td class="px-5 py-3.5">
                      <button
                        (click)="toggleActive(zone)"
                        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                        [class]="zone.is_active
                          ? 'bg-success-50 text-success-700 hover:bg-success-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                        [title]="zone.is_active ? 'Click to deactivate' : 'Click to activate'"
                      >
                        <span class="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
                          [class]="zone.is_active ? 'bg-success-500' : 'bg-gray-400'"></span>
                        {{ zone.is_active ? 'Active' : 'Inactive' }}
                      </button>
                    </td>
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-3">
                        <button
                          class="text-sm text-brand-500 hover:text-brand-700 font-medium transition-colors"
                          (click)="openForm(zone)"
                        >Edit</button>
                        <button
                          class="text-sm text-error-500 hover:text-error-700 font-medium transition-colors"
                          (click)="deleteZone(zone)"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <!-- /Desktop table -->
        }
      </div>
    </div>

    <!-- Zone Form Modal -->
    @if (showModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="closeModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10">
          <!-- Modal header -->
          <div class="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 class="text-base font-semibold text-gray-900">
              {{ editingZone() ? 'Edit zone' : 'New delivery zone' }}
            </h3>
            <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" (click)="closeModal()">✕</button>
          </div>

          <form [formGroup]="zoneForm" (ngSubmit)="saveZone()" class="p-6 space-y-5">
            <!-- Zone name -->
            <div>
              <label class="label">Zone name *</label>
              <input class="input-field" formControlName="name" placeholder="e.g. North Zone" />
              @if (zoneForm.get('name')?.invalid && zoneForm.get('name')?.touched) {
                <p class="text-xs text-error-500 mt-1">Zone name is required</p>
              }
            </div>

            <!-- Sectors tag input -->
            <div>
              <label class="label">Sectors / neighborhoods covered</label>
              <div class="border border-gray-300 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 min-h-[48px] focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-shadow">
                @for (s of sectors; track s) {
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-sm border border-brand-100">
                    {{ s }}
                    <button type="button" (click)="removeSector(s)" class="text-brand-400 hover:text-brand-600 leading-none ml-0.5">×</button>
                  </span>
                }
                <input
                  #sectorInput
                  type="text"
                  class="outline-none text-sm flex-1 min-w-[140px] placeholder:text-gray-400"
                  placeholder="Type a sector and press Enter..."
                  (keydown.enter)="addSector(sectorInput); $event.preventDefault()"
                  (keydown.comma)="addSector(sectorInput); $event.preventDefault()"
                />
              </div>
              <p class="text-xs text-gray-400 mt-1">Press Enter or comma to add each sector</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Delivery fee -->
              <div>
                <label class="label">Delivery fee (RD$) *</label>
                <input class="input-field" type="number" min="0" formControlName="delivery_fee" />
                @if (zoneForm.get('delivery_fee')?.invalid && zoneForm.get('delivery_fee')?.touched) {
                  <p class="text-xs text-error-500 mt-1">Must be 0 or more</p>
                }
              </div>
              <!-- Min order -->
              <div>
                <label class="label">Minimum order (RD$)</label>
                <input class="input-field" type="number" min="0" formControlName="min_order" />
              </div>
              <!-- Estimated time -->
              <div>
                <label class="label">Estimated time (minutes)</label>
                <input class="input-field" type="number" min="0" formControlName="estimated_time" />
              </div>
              <!-- Max radius -->
              <div>
                <label class="label">Max radius (km)</label>
                <input class="input-field" type="number" min="0" step="0.5" formControlName="max_distance_km" placeholder="e.g. 5" />
              </div>
              <!-- Extra km fee -->
              <div>
                <label class="label">Extra fee per km (RD$)</label>
                <input class="input-field" type="number" min="0" step="0.5" formControlName="extra_km_fee" />
              </div>
              <!-- Priority -->
              <div>
                <label class="label">Priority</label>
                <input class="input-field" type="number" min="1" formControlName="priority" />
                <p class="text-xs text-gray-400 mt-1">Lower number = higher priority</p>
              </div>
              <!-- Available from/until -->
              <div>
                <label class="label">Available from</label>
                <input class="input-field" type="time" formControlName="available_from" />
              </div>
              <div>
                <label class="label">Available until</label>
                <input class="input-field" type="time" formControlName="available_until" />
              </div>
            </div>

            <!-- Active toggle -->
            <div class="flex items-center gap-3 pt-1">
              <button
                type="button"
                class="relative inline-flex h-6 w-11 rounded-full transition-colors duration-200"
                [class]="zoneForm.get('is_active')!.value ? 'bg-brand-500' : 'bg-gray-200'"
                (click)="zoneForm.get('is_active')!.setValue(!zoneForm.get('is_active')!.value)"
              >
                <span
                  class="inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ml-0.5"
                  [class]="zoneForm.get('is_active')!.value ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
              <span class="text-sm font-medium text-gray-700">
                {{ zoneForm.get('is_active')!.value ? 'Zone is active' : 'Zone is inactive' }}
              </span>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancel</button>
              <button
                type="submit"
                class="btn-primary"
                [disabled]="zoneForm.invalid || saveLoading()"
              >
                {{ saveLoading() ? 'Saving...' : (editingZone() ? 'Save changes' : 'Create zone') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class StoreZonesPageComponent implements OnInit {
    private readonly storeAdminService = inject(StoreAdminService);
    private readonly toast = inject(ToastService);
    private readonly confirm = inject(ConfirmService);
    private readonly fb = inject(FormBuilder);
    private readonly supabase = getSupabaseClient();

    readonly zones = signal<DeliveryZone[]>([]);
    readonly loading = signal(true);
    readonly showModal = signal(false);
    readonly editingZone = signal<DeliveryZone | null>(null);
    readonly saveLoading = signal(false);

    sectors: string[] = [];

    readonly activeZones = () => this.zones().filter(z => z.is_active).length;
    readonly minFee = () => {
        const fees = this.zones().filter(z => z.is_active).map(z => z.delivery_fee);
        return fees.length ? Math.min(...fees) : 0;
    };
    readonly maxRadius = () => {
        const radii = this.zones().map(z => z.max_distance_km).filter((v): v is number => v != null);
        return radii.length ? Math.max(...radii) : null;
    };

    // Map helpers — read commerce lat/lng from the typed Restaurant signal (lat/lng are already in the type)
    readonly storeLat = () => this.storeAdminService.activeStore()?.lat ?? null;
    readonly storeLng = () => this.storeAdminService.activeStore()?.lng ?? null;
    readonly hasStoreCoords = () => !!(this.storeLat() && this.storeLng());
    readonly mapRadiusKm = () => {
        const active = this.zones().filter(z => z.is_active);
        const radii = active.map(z => z.max_distance_km).filter((v): v is number => v != null);
        return radii.length ? Math.max(...radii) : 3; // default 3km circle
    };

    readonly zoneForm = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
        delivery_fee: [0, [Validators.required, Validators.min(0)]],
        min_order: [0, [Validators.min(0)]],
        estimated_time: [30, [Validators.min(0)]],
        max_distance_km: [null as number | null],
        extra_km_fee: [0, [Validators.min(0)]],
        priority: [1, [Validators.min(1)]],
        available_from: [null as string | null],
        available_until: [null as string | null],
        is_active: [true],
    });

    ngOnInit(): void {
        this.loadZones();
    }

    private get storeId(): string {
        return this.storeAdminService.activeStoreId() ?? '';
    }

    async loadZones(): Promise<void> {
        if (!this.storeId) return;
        this.loading.set(true);
        const { data, error } = await this.supabase
            .from('delivery_zones')
            .select('*')
            .eq('commerce_id', this.storeId)
            .order('priority', { ascending: true });
        if (!error) this.zones.set((data ?? []) as DeliveryZone[]);
        this.loading.set(false);
    }

    openForm(zone?: DeliveryZone): void {
        this.editingZone.set(zone ?? null);
        this.sectors = [];
        this.zoneForm.reset({ delivery_fee: 0, min_order: 0, estimated_time: 30, priority: 1, is_active: true, extra_km_fee: 0 });
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
        this.zoneForm.reset();
    }

    addSector(input: HTMLInputElement): void {
        const val = input.value.trim().replace(/,/g, '');
        if (val && !this.sectors.includes(val)) this.sectors = [...this.sectors, val];
        input.value = '';
    }

    removeSector(sector: string): void {
        this.sectors = this.sectors.filter(s => s !== sector);
    }

    async saveZone(): Promise<void> {
        if (this.zoneForm.invalid || !this.storeId) return;
        this.saveLoading.set(true);
        try {
            const val = this.zoneForm.getRawValue();
            const payload: Partial<DeliveryZone> = {
                commerce_id: this.storeId,
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
            };
            const editing = this.editingZone();
            if (editing) {
                const { error } = await this.supabase.from('delivery_zones').update(payload).eq('id', editing.id);
                if (error) throw error;
            } else {
                const { error } = await this.supabase.from('delivery_zones').insert(payload);
                if (error) throw error;
            }
            this.toast.success(editing ? 'Zone updated' : 'Zone created');
            this.closeModal();
            await this.loadZones();
        } catch {
            this.toast.error('Error saving zone. Please try again.');
        } finally {
            this.saveLoading.set(false);
        }
    }

    async toggleActive(zone: DeliveryZone): Promise<void> {
        const { error } = await this.supabase
            .from('delivery_zones')
            .update({ is_active: !zone.is_active })
            .eq('id', zone.id);
        if (error) {
            this.toast.error('Error updating zone status');
            return;
        }
        this.zones.update(list => list.map(z => z.id === zone.id ? { ...z, is_active: !z.is_active } : z));
    }

    async deleteZone(zone: DeliveryZone): Promise<void> {
        const ok = await this.confirm.confirm({
            title: `Delete zone "${zone.name}"?`,
            message: 'This action cannot be undone.',
            confirmText: 'Delete',
            danger: true,
        });
        if (!ok) return;
        const { error } = await this.supabase.from('delivery_zones').delete().eq('id', zone.id);
        if (error) {
            this.toast.error('Error deleting zone');
            return;
        }
        this.toast.success('Zone deleted');
        this.zones.update(list => list.filter(z => z.id !== zone.id));
    }
}
