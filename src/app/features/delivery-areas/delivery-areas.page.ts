import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DeliveryAreasService, DeliveryAreaRow } from './delivery-areas.service';
import { TuttyMapComponent, LatLng } from '../../shared/ui/map/tutty-map.component';

@Component({
  selector: 'app-delivery-areas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, TuttyMapComponent],
  template: `
    <div class="p-6 space-y-6">
      <app-page-header
        title="Zonas Globales"
        subtitle="Nivel 1: el techo absoluto de dónde la app entrega. Fuera de estas zonas, ningún comercio puede entregar. Las zonas marcadas como especiales (ej. residenciales) además requieren autorización explícita por comercio y repartidor.">
        <button class="btn-primary text-sm" (click)="openAreaForm()">+ Nueva zona global</button>
      </app-page-header>

      @if (loading()) {
        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-6 text-sm text-[#6f7a8f]">
          Cargando zonas globales…
        </section>
      } @else {
        <section class="grid grid-cols-2 xl:grid-cols-4 gap-[14px]">
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Zonas activas</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statActive() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">{{ areas().length }} configuradas en total</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Con contorno delimitado</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statWithBoundary() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Resto usa radio como respaldo</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Zonas especiales</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statSpecial() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Requieren autorización explícita</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Comercios autorizados</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ commercesWithCoverageCount() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">A al menos una zona especial</small>
          </article>
        </section>

        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
          <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1]">
            <h3 class="m-0 text-base font-bold text-[#172033]">Zonas globales</h3>
            <p class="mt-1 text-xs text-[#6f7a8f]">El pedido solo se acepta si el destino cae dentro de alguna de estas zonas.</p>
          </header>
          <div class="overflow-x-auto">
            @if (areas().length === 0) {
              <p class="p-6 text-sm text-[#6f7a8f]">Aún no hay zonas globales. Crea la primera con "+ Nueva zona global".</p>
            } @else {
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-[11px] uppercase text-[#6f7a8f] bg-[#fbfcfe]">
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Zona</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Tipo</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Fee base</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Radio (km)</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Estado</th>
                    <th class="py-[14px] px-4 font-semibold whitespace-nowrap text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (area of areas(); track area.id) {
                    <tr class="border-b border-[#e5e9f1] last:border-b-0">
                      <td class="py-[14px] px-4 align-middle">
                        <strong class="block text-[#172033]">{{ area.name }}</strong>
                        <span class="block text-[#6f7a8f] text-[11px] mt-[3px]">{{ area.slug }}</span>
                      </td>
                      <td class="py-[14px] px-4 align-middle">
                        @if (area.requires_special_driver) {
                          <span class="inline-flex items-center gap-[6px] px-[9px] py-[6px] rounded-full text-[11px] font-extrabold text-[#b8860b] bg-[#fff5da]">Especial · x{{ area.special_fee_multiplier }}</span>
                        } @else {
                          <span class="inline-flex items-center gap-[6px] px-[9px] py-[6px] rounded-full text-[11px] font-extrabold text-[#344055] bg-[#f3f5f8]">Estándar</span>
                        }
                      </td>
                      <td class="py-[14px] px-4 align-middle text-[#344055]">RD$ {{ area.base_fee }}</td>
                      <td class="py-[14px] px-4 align-middle text-[#344055]">{{ area.radius_km ?? '—' }}</td>
                      <td class="py-[14px] px-4 align-middle">
                        <span
                          class="inline-flex items-center gap-[6px] px-[9px] py-[6px] rounded-full text-[11px] font-extrabold"
                          [class]="area.is_active ? 'text-[var(--admin-green)] bg-[var(--admin-green-soft)]' : 'text-gray-500 bg-gray-100'"
                        >
                          <span class="w-[7px] h-[7px] rounded-full bg-current"></span>
                          {{ area.is_active ? 'Activa' : 'Inactiva' }}
                        </span>
                      </td>
                      <td class="py-[14px] px-4 align-middle">
                        <div class="flex justify-end gap-2">
                          @if (area.has_boundary) {
                            <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" (click)="openBoundaryEditor(area, true)">Ver</button>
                          }
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" [class]="area.has_boundary ? 'text-[var(--admin-green)]' : ''" (click)="openBoundaryEditor(area)">{{ area.has_boundary ? 'Contorno ✓' : 'Delimitar' }}</button>
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" (click)="openAreaForm(area)">Editar</button>
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#f1d0d0] bg-white text-[12px] font-extrabold text-[#d93b3b]" (click)="deleteArea(area)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </section>

        <!-- Nivel 2: special-area commerce authorization -->
        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
          <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1]">
            <h3 class="m-0 text-base font-bold text-[#172033]">Autorización a zonas especiales</h3>
            <p class="mt-1 text-xs text-[#6f7a8f]">Solo aplica a zonas marcadas como "Especial". Un comercio sin autorización no puede entregar ahí aunque el destino esté dentro de una zona global normal a pocos metros.</p>
          </header>
          <div class="p-4">
            @if (specialAreas().length === 0) {
              <p class="text-sm text-[#6f7a8f]">No hay zonas especiales configuradas todavía.</p>
            } @else {
              <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,360px)_1fr_auto] gap-3 items-end">
                <div>
                  <label class="label" for="area-coverage-commerce">Comercio</label>
                  <select id="area-coverage-commerce" class="input-field" [(ngModel)]="selectedCommerceId" (ngModelChange)="loadSelectedCoverage()">
                    <option value="">Selecciona un comercio</option>
                    @for (commerce of commerces(); track commerce.id) {
                      <option [value]="commerce.id">{{ commerce.name }}</option>
                    }
                  </select>
                </div>
                <div>
                  <span class="label">Resumen</span>
                  <div class="mt-[7px] text-[#6f7a8f] text-xs">{{ selectedCoverageIds().length }} de {{ specialAreas().length }} zonas especiales seleccionadas</div>
                </div>
                <div>
                  <button type="button" class="btn-primary text-sm" [disabled]="!selectedCommerceId || savingCoverage()" (click)="saveCoverage()">
                    {{ savingCoverage() ? 'Guardando…' : 'Guardar autorización' }}
                  </button>
                </div>
              </div>

              @if (selectedCommerceId) {
                <div class="mt-[14px] grid grid-cols-1 md:grid-cols-2 gap-[10px]">
                  @for (area of specialAreas(); track area.id) {
                    <label class="border border-[#e5e9f1] rounded-xl p-[13px] flex items-center justify-between gap-3 bg-white">
                      <span>
                        <strong class="block text-[13px] text-[#172033]">{{ area.name }}</strong>
                        <span class="block text-[#6f7a8f] text-[11px] mt-[3px]">Recargo x{{ area.special_fee_multiplier }}</span>
                      </span>
                      <input type="checkbox" class="w-[18px] h-[18px] accent-[var(--admin-primary)]" [checked]="selectedCoverageIds().includes(area.id)" (change)="toggleCoverage(area.id)" />
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

    @if (showAreaForm()) {
      <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div class="w-full max-w-xl rounded-2xl bg-white p-4 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold mb-3">{{ editingArea() ? 'Editar zona global' : 'Nueva zona global' }}</h3>
          <div class="grid gap-3">
            <label class="grid gap-1">
              <span class="label">Nombre *</span>
              <input class="input-field" [(ngModel)]="areaForm.name" placeholder="Ej: San Pedro de Macorís" />
            </label>
            <label class="grid gap-1">
              <span class="label">Descripción</span>
              <textarea class="input-field min-h-16" [(ngModel)]="areaForm.description"></textarea>
            </label>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Fee base (RD$)</span><input type="number" min="0" class="input-field" [(ngModel)]="areaForm.base_fee" /></label>
              <label class="grid gap-1"><span class="label">Radio de respaldo (km)</span><input type="number" min="0" class="input-field" [(ngModel)]="areaForm.radius_km" /></label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Centro (lat)</span><input type="number" class="input-field" [(ngModel)]="areaForm.lat_center" /></label>
              <label class="grid gap-1"><span class="label">Centro (lng)</span><input type="number" class="input-field" [(ngModel)]="areaForm.lng_center" /></label>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Color</span><input type="color" class="input-field h-10" [(ngModel)]="areaForm.color" /></label>
              <label class="grid gap-1"><span class="label">Orden de visualización</span><input type="number" min="0" class="input-field" [(ngModel)]="areaForm.display_order" /></label>
            </div>
            <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="areaForm.is_active" /> Activa</label>
            <div class="rounded-xl border border-[#ffe3ac] bg-[#fffaf0] p-3">
              <label class="inline-flex items-center gap-2 text-sm font-semibold text-[#8a6d1f]">
                <input type="checkbox" [(ngModel)]="areaForm.requires_special_driver" /> Zona especial (requiere autorización por comercio y repartidor)
              </label>
              @if (areaForm.requires_special_driver) {
                <label class="grid gap-1 mt-2">
                  <span class="label">Recargo especial (multiplicador)</span>
                  <input type="number" min="1" step="0.1" class="input-field" [(ngModel)]="areaForm.special_fee_multiplier" />
                </label>
              }
            </div>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button class="btn-secondary" [disabled]="savingArea()" (click)="showAreaForm.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="savingArea()" (click)="saveArea()">{{ savingArea() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showBoundaryModal(); as boundaryArea) {
      <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div class="w-full max-w-2xl rounded-2xl bg-white p-4">
          <h3 class="text-lg font-bold mb-1">{{ boundaryReadOnly() ? 'Contorno de' : 'Delimitar' }} {{ boundaryArea.name }}</h3>
          <p class="text-xs text-[#6f7a8f] mb-3">
            @if (boundaryReadOnly()) {
              Vista de solo lectura del contorno guardado.
            } @else {
              Haz clic en el mapa para agregar vértices y dibujar el contorno real de la zona (mínimo 3 puntos).
              Arrastra un vértice para ajustarlo. Fuera de este contorno, ningún comercio puede entregar.
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
export class DeliveryAreasPageComponent implements OnInit {
  private readonly service = inject(DeliveryAreasService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly loading = signal(true);
  readonly areas = signal<DeliveryAreaRow[]>([]);

  readonly showAreaForm = signal(false);
  readonly editingArea = signal<DeliveryAreaRow | null>(null);
  readonly savingArea = signal(false);

  readonly showBoundaryModal = signal<DeliveryAreaRow | null>(null);
  readonly boundaryVertices = signal<LatLng[]>([]);
  readonly boundaryReadOnly = signal(false);
  readonly savingBoundary = signal(false);

  readonly commerces = signal<Array<{ id: string; name: string }>>([]);
  readonly selectedCoverageIds = signal<string[]>([]);
  readonly commercesWithCoverageCount = signal(0);
  readonly savingCoverage = signal(false);
  selectedCommerceId = '';

  areaForm: Partial<DeliveryAreaRow> = this.blankAreaForm();

  readonly specialAreas = computed(() => this.areas().filter((a) => a.requires_special_driver));
  readonly statActive = computed(() => this.areas().filter((a) => a.is_active).length);
  readonly statWithBoundary = computed(() => this.areas().filter((a) => a.has_boundary).length);
  readonly statSpecial = computed(() => this.specialAreas().length);

  ngOnInit(): void {
    void this.loadAll();
  }

  private blankAreaForm(): Partial<DeliveryAreaRow> {
    return {
      name: '', description: '', base_fee: 0, radius_km: null, lat_center: null, lng_center: null,
      color: '#FF3C97', display_order: null, is_active: true, requires_special_driver: false, special_fee_multiplier: 1,
    };
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [areas, commerces, coverageCount] = await Promise.all([
        this.service.listAreas(),
        this.service.listCommercesForCoverage(),
        this.service.countCommercesWithAreaCoverage(),
      ]);
      this.areas.set(areas);
      this.commerces.set(commerces);
      this.commercesWithCoverageCount.set(coverageCount);
    } catch {
      this.toast.error('No se pudieron cargar las zonas globales');
    } finally {
      this.loading.set(false);
    }
  }

  openAreaForm(area?: DeliveryAreaRow): void {
    this.editingArea.set(area ?? null);
    this.areaForm = area ? { ...area } : this.blankAreaForm();
    this.showAreaForm.set(true);
  }

  async saveArea(): Promise<void> {
    if (!this.areaForm.name?.trim()) {
      this.toast.error('El nombre es obligatorio');
      return;
    }
    this.savingArea.set(true);
    try {
      await this.service.saveArea({ ...this.editingArea(), ...this.areaForm });
      this.showAreaForm.set(false);
      await this.loadAll();
      this.toast.success('Zona global guardada');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'No se pudo guardar la zona global');
    } finally {
      this.savingArea.set(false);
    }
  }

  async deleteArea(area: DeliveryAreaRow): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Eliminar ${area.name}`,
      message: 'Esto puede afectar comercios/repartidores con cobertura o pedidos que dependan de esta zona. Esta acción no se puede deshacer.',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.service.deleteArea(area.id);
      await this.loadAll();
      this.toast.success('Zona global eliminada');
    } catch {
      this.toast.error('No se pudo eliminar la zona global. Verifica que no tenga cobertura o pedidos asociados.');
    }
  }

  async openBoundaryEditor(area: DeliveryAreaRow, readOnly = false): Promise<void> {
    this.showBoundaryModal.set(area);
    this.boundaryReadOnly.set(readOnly);
    this.boundaryVertices.set([]);
    if (area.has_boundary) {
      try {
        const vertices = await this.service.getAreaBoundary(area.id);
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
    const area = this.showBoundaryModal();
    if (!area) return;
    const vertices = this.boundaryVertices();
    if (vertices.length > 0 && vertices.length < 3) {
      this.toast.error('El contorno necesita al menos 3 vértices');
      return;
    }
    this.savingBoundary.set(true);
    try {
      await this.service.saveAreaBoundary(area.id, vertices);
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
      this.selectedCoverageIds.set(await this.service.getCommerceAreaCoverage(this.selectedCommerceId));
    } catch {
      this.toast.error('No se pudo cargar la autorización del comercio');
    }
  }

  toggleCoverage(areaId: string): void {
    const current = this.selectedCoverageIds();
    this.selectedCoverageIds.set(
      current.includes(areaId) ? current.filter((id) => id !== areaId) : [...current, areaId]
    );
  }

  async saveCoverage(): Promise<void> {
    if (!this.selectedCommerceId) return;
    this.savingCoverage.set(true);
    try {
      await this.service.saveCommerceAreaCoverage(this.selectedCommerceId, this.selectedCoverageIds());
      await this.loadAll();
      this.toast.success('Autorización actualizada');
    } catch {
      this.toast.error('No se pudo guardar la autorización');
    } finally {
      this.savingCoverage.set(false);
    }
  }
}
