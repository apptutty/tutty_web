import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DeliveryZonesGlobalService, GlobalZoneRow } from './delivery-zones-global.service';
import { TuttyMapComponent, LatLng } from '../../shared/ui/map/tutty-map.component';

@Component({
  selector: 'app-delivery-zones-global-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, TuttyMapComponent],
  template: `
    <div class="p-6 space-y-6">
      <app-page-header
        title="Zonas de Entrega (Globales)"
        subtitle="Nivel 3: sub-zonas dentro de una Zona Global (Nivel 1) con su propia tarifa y tiempo estimado. No están atadas a un comercio — la cobertura de cada comercio se autoriza aparte, abajo.">
        <button class="btn-primary text-sm" (click)="openZoneForm()">+ Nueva zona de entrega</button>
      </app-page-header>

      @if (loading()) {
        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-6 text-sm text-[#6f7a8f]">
          Cargando zonas de entrega…
        </section>
      } @else {
        <section class="grid grid-cols-2 xl:grid-cols-4 gap-[14px]">
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Zonas activas</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statActive() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">{{ zones().length }} configuradas en total</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Con contorno delimitado</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statWithBoundary() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Resto usa radio como respaldo</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Fee mínimo</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">RD$ {{ minFee() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Entre zonas activas</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Comercios con cobertura</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ commercesWithCoverageCount() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Autorizados a al menos una zona</small>
          </article>
        </section>

        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
          <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1]">
            <h3 class="m-0 text-base font-bold text-[#172033]">Zonas de entrega</h3>
            <p class="mt-1 text-xs text-[#6f7a8f]">Un comercio solo puede entregar en una zona si además está autorizado explícitamente (sección de abajo).</p>
          </header>
          <div class="overflow-x-auto">
            @if (zones().length === 0) {
              <p class="p-6 text-sm text-[#6f7a8f]">Aún no hay zonas de entrega globales. Crea la primera con "+ Nueva zona de entrega".</p>
            } @else {
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-[11px] uppercase text-[#6f7a8f] bg-[#fbfcfe]">
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Zona</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Zona global (Nivel 1)</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Tarifa</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Mín. pedido</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Tiempo est.</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Estado</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (zone of zones(); track zone.id) {
                    <tr class="border-b border-[#e5e9f1] last:border-b-0">
                      <td class="py-[14px] px-4 align-middle">
                        <strong class="block text-[#172033]">{{ zone.name }}</strong>
                        <span class="block text-[#6f7a8f] text-[11px] mt-[3px]">Prioridad {{ zone.priority }}</span>
                      </td>
                      <td class="py-[14px] px-4 align-middle text-[#344055]">{{ zone.area_name ?? '— (sin asignar)' }}</td>
                      <td class="py-[14px] px-4 align-middle text-[#344055]">RD$ {{ zone.delivery_fee }}</td>
                      <td class="py-[14px] px-4 align-middle text-[#344055]">RD$ {{ zone.min_order }}</td>
                      <td class="py-[14px] px-4 align-middle text-[#344055]">{{ zone.estimated_time }} min</td>
                      <td class="py-[14px] px-4 align-middle">
                        <span
                          class="inline-flex items-center gap-[6px] px-[9px] py-[6px] rounded-full text-[11px] font-extrabold"
                          [class]="zone.is_active ? 'text-[var(--admin-green)] bg-[var(--admin-green-soft)]' : 'text-gray-500 bg-gray-100'"
                        >
                          <span class="w-[7px] h-[7px] rounded-full bg-current"></span>
                          {{ zone.is_active ? 'Activa' : 'Inactiva' }}
                        </span>
                      </td>
                      <td class="py-[14px] px-4 align-middle">
                        <div class="flex justify-end gap-2">
                          @if (zone.has_boundary) {
                            <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" (click)="openBoundaryEditor(zone, true)">Ver</button>
                          }
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" [class]="zone.has_boundary ? 'text-[var(--admin-green)]' : ''" (click)="openBoundaryEditor(zone)">{{ zone.has_boundary ? 'Contorno ✓' : 'Delimitar' }}</button>
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" (click)="openZoneForm(zone)">Editar</button>
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#f1d0d0] bg-white text-[12px] font-extrabold text-[#d93b3b]" (click)="deleteZone(zone)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </section>

        <!-- Commerce zone-coverage authorization -->
        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
          <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1]">
            <h3 class="m-0 text-base font-bold text-[#172033]">Cobertura de comercios por zona</h3>
            <p class="mt-1 text-xs text-[#6f7a8f]">Un comercio sin autorización explícita a una zona no puede entregar ahí, aunque la zona esté activa.</p>
          </header>
          <div class="p-4">
            @if (zones().length === 0) {
              <p class="text-sm text-[#6f7a8f]">No hay zonas de entrega configuradas todavía.</p>
            } @else {
              <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,360px)_1fr_auto] gap-3 items-end">
                <div>
                  <label class="label" for="zone-coverage-commerce">Comercio</label>
                  <select id="zone-coverage-commerce" class="input-field" [(ngModel)]="selectedCommerceId" (ngModelChange)="loadSelectedCoverage()">
                    <option value="">Selecciona un comercio</option>
                    @for (commerce of commerces(); track commerce.id) {
                      <option [value]="commerce.id">{{ commerce.name }}</option>
                    }
                  </select>
                </div>
                <div>
                  <span class="label">Resumen</span>
                  <div class="mt-[7px] text-[#6f7a8f] text-xs">{{ selectedCoverageIds().length }} de {{ zones().length }} zonas seleccionadas</div>
                </div>
                <div>
                  <button type="button" class="btn-primary text-sm" [disabled]="!selectedCommerceId || savingCoverage()" (click)="saveCoverage()">
                    {{ savingCoverage() ? 'Guardando…' : 'Guardar cobertura' }}
                  </button>
                </div>
              </div>

              @if (selectedCommerceId) {
                <div class="mt-[14px] grid grid-cols-1 md:grid-cols-2 gap-[10px]">
                  @for (zone of zones(); track zone.id) {
                    <label class="border border-[#e5e9f1] rounded-xl p-[13px] flex items-center justify-between gap-3 bg-white">
                      <span>
                        <strong class="block text-[13px] text-[#172033]">{{ zone.name }}</strong>
                        <span class="block text-[#6f7a8f] text-[11px] mt-[3px]">RD$ {{ zone.delivery_fee }} · {{ zone.area_name ?? 'sin zona global asignada' }}</span>
                      </span>
                      <input type="checkbox" class="w-[18px] h-[18px] accent-[var(--admin-primary)]" [checked]="selectedCoverageIds().includes(zone.id)" (change)="toggleCoverage(zone.id)" />
                    </label>
                  }
                </div>
              }
              <p class="mt-3 text-[#6f7a8f] text-xs">Los cambios solo se aplican después de guardar.</p>
            }
          </div>
        </section>
      }
    </div>

    @if (showZoneForm()) {
      <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div class="w-full max-w-xl rounded-2xl bg-white p-4 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold mb-3">{{ editingZone() ? 'Editar zona de entrega' : 'Nueva zona de entrega' }}</h3>
          <div class="grid gap-3">
            <label class="grid gap-1">
              <span class="label">Nombre *</span>
              <input class="input-field" [(ngModel)]="zoneForm.name" placeholder="Ej: Zona Norte" />
            </label>
            <label class="grid gap-1">
              <span class="label">Zona global (Nivel 1)</span>
              <select class="input-field" [(ngModel)]="zoneForm.area_id">
                <option [ngValue]="null">Sin asignar</option>
                @for (area of areas(); track area.id) {
                  <option [value]="area.id">{{ area.name }}</option>
                }
              </select>
            </label>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Tarifa de entrega (RD$) *</span><input type="number" min="0" class="input-field" [(ngModel)]="zoneForm.delivery_fee" /></label>
              <label class="grid gap-1"><span class="label">Monto mínimo de pedido (RD$)</span><input type="number" min="0" class="input-field" [(ngModel)]="zoneForm.min_order" /></label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Tiempo estimado (min)</span><input type="number" min="0" max="600" class="input-field" [(ngModel)]="zoneForm.estimated_time" /></label>
              <label class="grid gap-1"><span class="label">Radio máximo (km)</span><input type="number" min="0" max="200" step="0.1" class="input-field" [(ngModel)]="zoneForm.max_distance_km" /></label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Tarifa extra por km (RD$)</span><input type="number" min="0" class="input-field" [(ngModel)]="zoneForm.extra_km_fee" /></label>
              <label class="grid gap-1"><span class="label">Prioridad</span><input type="number" min="1" class="input-field" [(ngModel)]="zoneForm.priority" /></label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Disponible desde</span><input type="time" class="input-field" [(ngModel)]="zoneForm.available_from" /></label>
              <label class="grid gap-1"><span class="label">Disponible hasta</span><input type="time" class="input-field" [(ngModel)]="zoneForm.available_until" /></label>
            </div>
            <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="zoneForm.is_active" /> Activa</label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button class="btn-secondary" [disabled]="savingZone()" (click)="showZoneForm.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="savingZone()" (click)="saveZone()">{{ savingZone() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showBoundaryModal(); as boundaryZone) {
      <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div class="w-full max-w-2xl rounded-2xl bg-white p-4">
          <h3 class="text-lg font-bold mb-1">{{ boundaryReadOnly() ? 'Contorno de' : 'Delimitar' }} {{ boundaryZone.name }}</h3>
          <p class="text-xs text-[#6f7a8f] mb-3">
            @if (boundaryReadOnly()) {
              Vista de solo lectura del contorno guardado.
            } @else {
              Haz clic en el mapa para agregar vértices y dibujar el contorno real de la zona (mínimo 3 puntos).
              Arrastra un vértice para ajustarlo.
            }
          </p>
          <app-tutty-map
            mode="polygon"
            [editable]="!boundaryReadOnly()"
            [vertices]="boundaryVertices()"
            height="360px"
            (verticesChange)="boundaryVertices.set($event)">
          </app-tutty-map>
          @if (!boundaryReadOnly()) {
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="text-xs text-[#6f7a8f]">{{ boundaryVertices().length }} vértice(s)</span>
              <div class="flex gap-2">
                <button class="btn-secondary text-xs" type="button" [disabled]="boundaryVertices().length === 0" (click)="undoLastBoundaryVertex()">Deshacer último</button>
                <button class="btn-secondary text-xs" type="button" [disabled]="boundaryVertices().length === 0" (click)="clearBoundaryVertices()">Limpiar</button>
              </div>
            </div>
          }
          <div class="mt-4 flex justify-end gap-2">
            @if (boundaryReadOnly()) {
              <button class="btn-secondary" (click)="showBoundaryModal.set(null)">Cerrar</button>
            } @else {
              <button class="btn-secondary" [disabled]="savingBoundary()" (click)="showBoundaryModal.set(null)">Cancelar</button>
              <button class="btn-primary" [disabled]="savingBoundary()" (click)="saveBoundary()">{{ savingBoundary() ? 'Guardando…' : 'Guardar contorno' }}</button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DeliveryZonesGlobalPageComponent implements OnInit {
  private readonly service = inject(DeliveryZonesGlobalService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly loading = signal(true);
  readonly zones = signal<GlobalZoneRow[]>([]);
  readonly areas = signal<Array<{ id: string; name: string }>>([]);

  readonly showZoneForm = signal(false);
  readonly editingZone = signal<GlobalZoneRow | null>(null);
  readonly savingZone = signal(false);

  readonly showBoundaryModal = signal<GlobalZoneRow | null>(null);
  readonly boundaryVertices = signal<LatLng[]>([]);
  readonly boundaryReadOnly = signal(false);
  readonly savingBoundary = signal(false);

  readonly commerces = signal<Array<{ id: string; name: string }>>([]);
  readonly selectedCoverageIds = signal<string[]>([]);
  readonly commercesWithCoverageCount = signal(0);
  readonly savingCoverage = signal(false);
  selectedCommerceId = '';

  zoneForm: Partial<GlobalZoneRow> = this.blankZoneForm();

  readonly statActive = computed(() => this.zones().filter((z) => z.is_active).length);
  readonly statWithBoundary = computed(() => this.zones().filter((z) => z.has_boundary).length);
  readonly minFee = computed(() => {
    const fees = this.zones().filter((z) => z.is_active).map((z) => z.delivery_fee);
    return fees.length ? Math.min(...fees) : 0;
  });

  ngOnInit(): void {
    void this.loadAll();
  }

  private blankZoneForm(): Partial<GlobalZoneRow> {
    return {
      name: '', area_id: null, sector_list: [], delivery_fee: 0, min_order: 0, estimated_time: 30,
      max_distance_km: null, extra_km_fee: 0, priority: 1, available_from: null, available_until: null, is_active: true,
    };
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [zones, areas, commerces, coverageCount] = await Promise.all([
        this.service.listGlobalZones(),
        this.service.listAreasForSelect(),
        this.service.listCommercesForCoverage(),
        this.service.countCommercesWithZoneCoverage(),
      ]);
      this.zones.set(zones);
      this.areas.set(areas);
      this.commerces.set(commerces);
      this.commercesWithCoverageCount.set(coverageCount);
    } catch {
      this.toast.error('No se pudieron cargar las zonas de entrega');
    } finally {
      this.loading.set(false);
    }
  }

  openZoneForm(zone?: GlobalZoneRow): void {
    this.editingZone.set(zone ?? null);
    this.zoneForm = zone ? { ...zone } : this.blankZoneForm();
    this.showZoneForm.set(true);
  }

  async saveZone(): Promise<void> {
    if (!this.zoneForm.name?.trim()) {
      this.toast.error('El nombre es obligatorio');
      return;
    }
    if ((this.zoneForm.delivery_fee ?? 0) < 0) {
      this.toast.error('La tarifa de entrega no puede ser negativa');
      return;
    }
    this.savingZone.set(true);
    try {
      await this.service.saveZone({ ...this.editingZone(), ...this.zoneForm });
      this.showZoneForm.set(false);
      await this.loadAll();
      this.toast.success('Zona de entrega guardada');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'No se pudo guardar la zona de entrega');
    } finally {
      this.savingZone.set(false);
    }
  }

  async deleteZone(zone: GlobalZoneRow): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Eliminar ${zone.name}`,
      message: 'Esto puede afectar comercios con cobertura activa o pedidos que dependan de esta zona. Esta acción no se puede deshacer.',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.service.deleteZone(zone.id);
      await this.loadAll();
      this.toast.success('Zona de entrega eliminada');
    } catch {
      this.toast.error('No se pudo eliminar la zona. Verifica que no tenga cobertura o pedidos asociados.');
    }
  }

  async openBoundaryEditor(zone: GlobalZoneRow, readOnly = false): Promise<void> {
    this.showBoundaryModal.set(zone);
    this.boundaryReadOnly.set(readOnly);
    this.boundaryVertices.set([]);
    if (zone.has_boundary) {
      try {
        const vertices = await this.service.getZoneBoundary(zone.id);
        this.boundaryVertices.set(vertices ?? []);
      } catch {
        this.toast.error('No se pudo cargar el contorno actual');
      }
    }
  }

  undoLastBoundaryVertex(): void {
    this.boundaryVertices.set(this.boundaryVertices().slice(0, -1));
  }

  clearBoundaryVertices(): void {
    this.boundaryVertices.set([]);
  }

  async saveBoundary(): Promise<void> {
    const zone = this.showBoundaryModal();
    if (!zone) return;
    const vertices = this.boundaryVertices();
    if (vertices.length > 0 && vertices.length < 3) {
      this.toast.error('El contorno necesita al menos 3 vértices');
      return;
    }
    this.savingBoundary.set(true);
    try {
      await this.service.saveZoneBoundary(zone.id, vertices);
      this.showBoundaryModal.set(null);
      await this.loadAll();
      this.toast.success(vertices.length === 0 ? 'Contorno eliminado' : 'Contorno guardado');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'No se pudo guardar el contorno');
    } finally {
      this.savingBoundary.set(false);
    }
  }

  async loadSelectedCoverage(): Promise<void> {
    if (!this.selectedCommerceId) {
      this.selectedCoverageIds.set([]);
      return;
    }
    try {
      this.selectedCoverageIds.set(await this.service.getCommerceZoneCoverage(this.selectedCommerceId));
    } catch {
      this.toast.error('No se pudo cargar la cobertura del comercio');
    }
  }

  toggleCoverage(zoneId: string): void {
    const current = this.selectedCoverageIds();
    this.selectedCoverageIds.set(
      current.includes(zoneId) ? current.filter((id) => id !== zoneId) : [...current, zoneId],
    );
  }

  async saveCoverage(): Promise<void> {
    if (!this.selectedCommerceId) return;
    this.savingCoverage.set(true);
    try {
      await this.service.saveCommerceZoneCoverage(this.selectedCommerceId, this.selectedCoverageIds());
      await this.loadAll();
      this.toast.success('Cobertura actualizada');
    } catch {
      this.toast.error('No se pudo guardar la cobertura');
    } finally {
      this.savingCoverage.set(false);
    }
  }
}
