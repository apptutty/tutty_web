import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreAdminService } from '../store-admin.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { DeliveryZone } from '../../../core/supabase/database.types';
import { TuttyMapComponent, LatLng } from '../../../shared/ui/map/tutty-map.component';
import { AdminPageHeaderComponent } from '../shared/admin-page-header.component';
import { AdminEmptyStateComponent } from '../shared/admin-empty-state.component';

/**
 * Zonas de entrega — comercio.
 *
 * Las zonas (`delivery_zones`) ahora son globales/compartidas y las administra super_admin
 * (nombre, tarifa, contorno). El comercio solo puede togglear su propia cobertura sobre las
 * zonas activas existentes vía la RPC `save_commerce_delivery_zone_coverage`, ya que la
 * migración `033_delivery_zones_write_policy` (ya aplicada en producción) restringe la
 * escritura de la definición de la zona a super_admin. Antes este componente insertaba/
 * editaba/borraba filas de `delivery_zones` directamente — eso ahora falla por RLS.
 */
@Component({
    selector: 'app-store-zones',
    standalone: true,
    imports: [CommonModule, TuttyMapComponent, AdminPageHeaderComponent, AdminEmptyStateComponent],
    template: `
    <div class="p-6 lg:p-8 space-y-6">
      <!-- Header -->
      <app-admin-page-header
        title="Delivery Zones"
        subtitle="Elige a cuáles zonas de entrega, ya configuradas por Tutty, puede llegar tu comercio."
      />

      <!-- Coverage summary -->
      @if (zones().length > 0) {
        <div class="bg-brand-50 border border-brand-200 rounded-xl px-5 py-4 flex flex-wrap gap-6">
          <div>
            <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Zonas cubiertas</p>
            <p class="text-2xl font-bold text-brand-700">{{ coveredZoneIds().length }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-brand-600 uppercase tracking-wide">Zonas disponibles</p>
            <p class="text-2xl font-bold text-brand-700">{{ zones().length }}</p>
          </div>
        </div>
      }

      <!-- No location warning -->
      @if (!hasStoreCoords()) {
        <div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span class="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p class="font-medium">Comercio sin coordenadas configuradas</p>
            <p class="text-xs mt-0.5">El cálculo de delivery puede no funcionar bien. Ve a <strong>Configuración → Perfil → Ubicación en mapa</strong> para configurarlas.</p>
          </div>
        </div>
      }

      <!-- Zones list -->
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
              title="No hay zonas de entrega disponibles todavía"
              description="Tutty aún no ha configurado zonas de entrega globales en tu área. Contacta al equipo de Tutty." />
          </div>
        } @else {
          <div class="divide-y divide-gray-100">
            @for (zone of zones(); track zone.id) {
              <div class="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-semibold text-gray-800">{{ zone.name }}</p>
                    @if (!zone.is_active) {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactiva</span>
                    }
                  </div>
                  <p class="text-xs text-gray-400 mt-0.5">Prioridad {{ zone.priority }} · RD$ {{ zone.delivery_fee }} · Mín. RD$ {{ zone.min_order }}</p>
                  @if (zone.sector_list.length > 0) {
                    <div class="flex flex-wrap gap-1 mt-2">
                      @for (sector of zone.sector_list; track sector) {
                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{{ sector }}</span>
                      }
                    </div>
                  }
                  @if (zone.boundary) {
                    <button type="button" class="text-xs text-gray-500 hover:text-gray-700 font-medium mt-2" (click)="openZoneBoundaryViewer(zone)">Ver contorno</button>
                  }
                </div>
                <label class="flex items-center gap-2 flex-shrink-0 cursor-pointer" [class.opacity-50]="!zone.is_active">
                  <span class="text-xs text-gray-500 whitespace-nowrap">{{ coveredZoneIds().includes(zone.id) ? 'Cubro esta zona' : 'No cubierta' }}</span>
                  <input
                    type="checkbox"
                    class="w-[18px] h-[18px] accent-brand-500"
                    [checked]="coveredZoneIds().includes(zone.id)"
                    [disabled]="!zone.is_active || savingCoverage()"
                    (change)="toggleCoverage(zone.id)"
                  />
                </label>
              </div>
            }
          </div>
        }
      </div>
      <p class="text-xs text-gray-400">Las zonas se crean y delimitan desde el panel de Tutty. Aquí solo defines a cuáles puede llegar tu comercio.</p>
    </div>

    <!-- Zone Boundary Viewer (read-only) -->
    @if (showZoneBoundaryModal(); as boundaryZone) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="showZoneBoundaryModal.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 p-6">
          <h3 class="text-base font-semibold text-gray-900 mb-1">Contorno de "{{ boundaryZone.name }}"</h3>
          <p class="text-xs text-gray-500 mb-3">Vista de solo lectura del contorno guardado por Tutty.</p>
          <app-tutty-map
            mode="polygon"
            [editable]="false"
            [vertices]="zoneBoundaryVertices()"
            [lat]="storeLat()"
            [lng]="storeLng()"
            height="360px">
          </app-tutty-map>
          <div class="mt-4 flex justify-end">
            <button class="btn-secondary" (click)="showZoneBoundaryModal.set(null)">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class StoreZonesPageComponent implements OnInit {
    private readonly storeAdminService = inject(StoreAdminService);
    private readonly toast = inject(ToastService);
    private readonly supabase = getSupabaseClient();

    readonly zones = signal<DeliveryZone[]>([]);
    readonly loading = signal(true);
    readonly savingCoverage = signal(false);

    readonly coveredZoneIds = signal<string[]>([]);

    readonly showZoneBoundaryModal = signal<DeliveryZone | null>(null);
    readonly zoneBoundaryVertices = signal<LatLng[]>([]);

    readonly storeLat = () => this.storeAdminService.activeStore()?.lat ?? null;
    readonly storeLng = () => this.storeAdminService.activeStore()?.lng ?? null;
    readonly hasStoreCoords = () => !!(this.storeLat() && this.storeLng());

    ngOnInit(): void {
        this.loadZones();
    }

    private get storeId(): string {
        return this.storeAdminService.activeStoreId() ?? '';
    }

    async loadZones(): Promise<void> {
        if (!this.storeId) return;
        this.loading.set(true);
        try {
            const [zonesResult, coverageResult] = await Promise.all([
                // Global zones (commerce_id null) plus any legacy zone still tied directly to this commerce.
                this.supabase
                    .from('delivery_zones')
                    .select('*')
                    .or(`commerce_id.is.null,commerce_id.eq.${this.storeId}`)
                    .order('priority', { ascending: true }),
                this.supabase
                    .from('commerce_delivery_zone_coverage')
                    .select('zone_id')
                    .eq('commerce_id', this.storeId),
            ]);
            if (zonesResult.error) throw zonesResult.error;
            if (coverageResult.error) throw coverageResult.error;
            this.zones.set((zonesResult.data ?? []) as DeliveryZone[]);
            this.coveredZoneIds.set(((coverageResult.data ?? []) as any[]).map((row) => row.zone_id as string));
        } catch {
            this.toast.error('No se pudieron cargar las zonas de entrega');
        } finally {
            this.loading.set(false);
        }
    }

    async toggleCoverage(zoneId: string): Promise<void> {
        const current = this.coveredZoneIds();
        const next = current.includes(zoneId) ? current.filter((id) => id !== zoneId) : [...current, zoneId];
        this.savingCoverage.set(true);
        try {
            const { error } = await this.supabase.rpc('save_commerce_delivery_zone_coverage', {
                p_commerce_id: this.storeId,
                p_zone_ids: next,
            });
            if (error) throw error;
            this.coveredZoneIds.set(next);
            this.toast.success(next.includes(zoneId) ? 'Zona agregada a tu cobertura' : 'Zona removida de tu cobertura');
        } catch {
            this.toast.error('No se pudo actualizar la cobertura');
        } finally {
            this.savingCoverage.set(false);
        }
    }

    async openZoneBoundaryViewer(zone: DeliveryZone): Promise<void> {
        this.showZoneBoundaryModal.set(zone);
        this.zoneBoundaryVertices.set([]);
        try {
            const { data, error } = await this.supabase.rpc('get_delivery_zone_boundary', { p_zone_id: zone.id });
            if (error) throw error;
            this.zoneBoundaryVertices.set((data as LatLng[] | null) ?? []);
        } catch {
            this.toast.error('No se pudo cargar el contorno actual');
        }
    }
}
