import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { BeachesService, BeachPointRow, BeachRow } from './beaches.service';
import { TuttyMapComponent, LatLng } from '../../shared/ui/map/tutty-map.component';

@Component({
  selector: 'app-beaches-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, TuttyMapComponent],
  template: `
    <div class="p-6 space-y-6">
      <app-page-header title="Beach Delivery" subtitle="Administra playas, puntos de entrega y cobertura comercial desde un solo lugar.">
        <button class="btn-primary text-sm" (click)="openBeachForm()">+ Nueva playa</button>
      </app-page-header>

      @if (loading()) {
        <section class="grid grid-cols-2 xl:grid-cols-4 gap-[14px]">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4 h-[86px] animate-pulse"></div>
          }
        </section>
        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-6 text-sm text-[#6f7a8f]">
          Cargando Beach Delivery…
        </section>
      } @else {
        <!-- Stats -->
        <section class="grid grid-cols-2 xl:grid-cols-4 gap-[14px]">
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Playas activas</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statActiveBeaches() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">{{ beaches().length }} configuradas en total</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Puntos de entrega</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ statTotalPoints() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Distribuidos en {{ statBeachesWithPoints() }} playas</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Comercios con cobertura</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ commercesWithCoverageCount() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">{{ commercesWithCoverageCount() > 0 ? 'Configurado por comercio' : 'Requiere configuración' }}</small>
          </article>
          <article class="rounded-[14px] border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] p-4">
            <span class="block text-[#6f7a8f] text-xs">Pendientes</span>
            <strong class="block mt-[7px] text-[24px] leading-none font-bold text-[#172033]">{{ pendingCoverageChanges() }}</strong>
            <small class="block mt-[5px] text-[#6f7a8f] text-xs">Cobertura sin guardar</small>
          </article>
        </section>

        <!-- Workspace: beaches + selected beach detail -->
        <section class="grid grid-cols-1 xl:grid-cols-[1.15fr_minmax(420px,0.85fr)] gap-[18px] items-start">
          <article class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
            <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1] flex flex-wrap items-center justify-between gap-[14px]">
              <div>
                <h3 class="m-0 text-base font-bold text-[#172033]">Playas</h3>
                <p class="mt-1 text-xs text-[#6f7a8f]">Selecciona una playa para ver y administrar sus puntos.</p>
              </div>
              <label class="min-w-[240px] h-10 border border-[#e5e9f1] rounded-[10px] flex items-center gap-2 px-[11px] bg-[#f9fafc]">
                <span class="text-[#667085]">⌕</span>
                <input
                  type="search"
                  class="w-full border-0 outline-none bg-transparent text-sm"
                  placeholder="Buscar playa o ciudad"
                  aria-label="Buscar playa o ciudad"
                  [(ngModel)]="beachSearchTerm"
                />
              </label>
            </header>
            <div class="overflow-x-auto">
              @if (filteredBeaches().length === 0) {
                <p class="p-6 text-sm text-[#6f7a8f]">
                  {{ beaches().length === 0 ? 'Aún no hay playas registradas. Crea la primera con “+ Nueva playa”.' : 'Ninguna playa coincide con tu búsqueda.' }}
                </p>
              } @else {
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="text-left text-[11px] uppercase text-[#6f7a8f] bg-[#fbfcfe]">
                      <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Playa</th>
                      <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Ciudad / sector</th>
                      <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Estado</th>
                      <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Puntos</th>
                      <th class="py-[14px] px-4 font-semibold whitespace-nowrap">Comercios</th>
                      <th class="py-[14px] px-4 font-semibold whitespace-nowrap text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (beach of filteredBeaches(); track beach.id) {
                      <tr
                        class="cursor-pointer border-b border-[#e5e9f1] last:border-b-0 transition-colors"
                        [class]="rowClass(beach)"
                        (click)="selectBeach(beach)"
                      >
                        <td class="py-[14px] px-4 align-middle">
                          <strong class="block text-[#172033]">{{ beach.name }}</strong>
                          <span class="block text-[#6f7a8f] text-[11px] mt-[3px]">{{ beachCreatedLabel(beach) }}</span>
                        </td>
                        <td class="py-[14px] px-4 align-middle whitespace-nowrap text-[#344055]">
                          {{ beach.city || '—' }}{{ beach.sector ? ' · ' + beach.sector : '' }}
                        </td>
                        <td class="py-[14px] px-4 align-middle">
                          <span
                            class="inline-flex items-center gap-[6px] px-[9px] py-[6px] rounded-full text-[11px] font-extrabold"
                            [class]="beach.is_active ? 'text-[var(--admin-green)] bg-[var(--admin-green-soft)]' : 'text-gray-500 bg-gray-100'"
                          >
                            <span class="w-[7px] h-[7px] rounded-full bg-current"></span>
                            {{ beach.is_active ? 'Activa' : 'Inactiva' }}
                          </span>
                        </td>
                        <td class="py-[14px] px-4 align-middle text-[#344055]">{{ beach.points_count }}</td>
                        <td class="py-[14px] px-4 align-middle text-[#344055]">{{ beach.commerces_count }}</td>
                        <td class="py-[14px] px-4 align-middle">
                          <div class="flex justify-end gap-2">
                            <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" (click)="openBeachForm(beach); $event.stopPropagation()">Editar</button>
                            <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#f1d0d0] bg-white text-[12px] font-extrabold text-[#d93b3b]" (click)="deleteBeach(beach); $event.stopPropagation()">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </article>

          <aside class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
            @if (!selectedBeach()) {
              <div class="p-6 text-sm text-[#6f7a8f]">Selecciona una playa para ver y administrar sus puntos.</div>
            } @else {
              <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1] flex flex-wrap items-center justify-between gap-[14px]">
                <div>
                  <h3 class="m-0 text-base font-bold text-[#172033]">{{ selectedBeach()!.name }}</h3>
                  <p class="mt-1 text-xs text-[#6f7a8f]">{{ pointsCountLabel() }}</p>
                </div>
                <button type="button" class="btn-secondary text-xs" (click)="openPointForm()">+ Nuevo punto</button>
              </header>

              <div class="p-4 grid grid-cols-2 gap-[10px] border-b border-[#e5e9f1] bg-[#fcfcfe]">
                <div class="p-3 rounded-xl bg-white border border-[#e5e9f1]">
                  <span class="block text-[11px] text-[#6f7a8f]">Ciudad</span>
                  <strong class="block mt-[5px] text-[13px] text-[#172033]">{{ selectedBeach()!.city || '—' }}</strong>
                </div>
                <div class="p-3 rounded-xl bg-white border border-[#e5e9f1]">
                  <span class="block text-[11px] text-[#6f7a8f]">Sector</span>
                  <strong class="block mt-[5px] text-[13px] text-[#172033]">{{ selectedBeach()!.sector || '—' }}</strong>
                </div>
              </div>

              <div class="p-3">
                @if (points().length === 0) {
                  <p class="p-3 text-sm text-[#6f7a8f]">Esta playa aún no tiene puntos de entrega. Crea el primero con “+ Nuevo punto”.</p>
                } @else {
                  <div class="space-y-[10px]">
                    @for (point of points(); track point.id) {
                      <article class="border border-[#e5e9f1] rounded-[13px] p-[14px] grid grid-cols-[1fr_auto] gap-3 items-start">
                        <div>
                          <h4 class="m-0 text-[13px] font-bold text-[#172033]">{{ point.name }}</h4>
                          @if (point.reference_notes) {
                            <p class="mt-[5px] text-[#6f7a8f] text-xs leading-[1.45]">{{ point.reference_notes }}</p>
                          }
                          <div class="flex gap-[7px] flex-wrap mt-[9px]">
                            <span class="px-2 py-[5px] rounded-full bg-[#f3f5f8] text-[#5e6879] text-[11px]">Lat {{ point.lat }}</span>
                            <span class="px-2 py-[5px] rounded-full bg-[#f3f5f8] text-[#5e6879] text-[11px]">Lng {{ point.lng }}</span>
                            <span class="px-2 py-[5px] rounded-full bg-[#f3f5f8] text-[#5e6879] text-[11px]">{{ point.is_active ? 'Activo' : 'Inactivo' }}</span>
                          </div>
                        </div>
                        <div class="flex flex-col gap-2">
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#e5e9f1] bg-white text-[12px] font-extrabold" (click)="openPointForm(point)">Editar</button>
                          <button type="button" class="min-h-[34px] px-[11px] rounded-[9px] border border-[#f1d0d0] bg-white text-[12px] font-extrabold text-[#d93b3b]" (click)="deletePoint(point)">Eliminar</button>
                        </div>
                      </article>
                    }
                  </div>
                }
              </div>
            }
          </aside>
        </section>

        <!-- Coverage -->
        <section class="rounded-2xl border border-[#e5e9f1] bg-white shadow-[0_10px_28px_rgba(25,35,58,.07)] overflow-hidden">
          <header class="min-h-[64px] px-4 py-[14px] border-b border-[#e5e9f1]">
            <h3 class="m-0 text-base font-bold text-[#172033]">Cobertura por comercio</h3>
            <p class="mt-1 text-xs text-[#6f7a8f]">Define en cuáles playas puede operar cada comercio.</p>
          </header>
          <div class="p-4">
            <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,360px)_1fr_auto] gap-3 items-end">
              <div>
                <label class="label" for="beach-coverage-commerce">Comercio</label>
                <select
                  id="beach-coverage-commerce"
                  class="input-field"
                  [(ngModel)]="selectedCommerceId"
                  (ngModelChange)="loadSelectedCoverage()"
                >
                  <option value="">Selecciona un comercio</option>
                  @for (commerce of commerces(); track commerce.id) {
                    <option [value]="commerce.id">{{ commerce.name }}{{ commerce.is_beach_delivery ? ' · Entrega a playa' : '' }}</option>
                  }
                </select>
              </div>
              <div>
                <span class="label">Resumen</span>
                <div class="mt-[7px] text-[#6f7a8f] text-xs">{{ selectedCoverageIds().length }} de {{ beaches().length }} playas seleccionadas</div>
                @if (selectedCommerceId && !selectedCommerceHasBeachDelivery()) {
                  <div class="mt-[7px] text-[#d93b3b] text-xs">
                    Este comercio no tiene activada la "Entrega a playa": aunque guardes cobertura, no aparecerá en la app hasta activarla en su perfil.
                  </div>
                }
              </div>
              <div>
                <button type="button" class="btn-primary text-sm" [disabled]="!selectedCommerceId || savingCoverage()" (click)="saveCoverage()">
                  {{ savingCoverage() ? 'Guardando…' : 'Guardar cobertura' }}
                </button>
              </div>
            </div>

            @if (selectedCommerceId) {
              <div class="mt-[14px] grid grid-cols-1 md:grid-cols-2 gap-[10px]">
                @for (beach of beaches(); track beach.id) {
                  <label class="border border-[#e5e9f1] rounded-xl p-[13px] flex items-center justify-between gap-3 bg-white">
                    <span>
                      <strong class="block text-[13px] text-[#172033]">{{ beach.name }}</strong>
                      <span class="block text-[#6f7a8f] text-[11px] mt-[3px]">{{ beach.city || 'Sin ciudad' }}</span>
                    </span>
                    <input
                      type="checkbox"
                      class="w-[18px] h-[18px] accent-[var(--admin-primary)]"
                      [checked]="selectedCoverageIds().includes(beach.id)"
                      (change)="toggleCoverage(beach.id)"
                    />
                  </label>
                }
              </div>
            }
            <p class="mt-3 text-[#6f7a8f] text-xs">Los cambios solo se aplican después de guardar.</p>
          </div>
        </section>
      }
    </div>

    @if (showBeachForm()) {
      <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div class="w-full max-w-xl rounded-2xl bg-white p-4">
          <h3 class="text-lg font-bold mb-3">{{ editingBeach() ? 'Editar playa' : 'Nueva playa' }}</h3>
          <div class="grid gap-3">
            <label class="grid gap-1">
              <span class="label">Nombre *</span>
              <input class="input-field" [(ngModel)]="beachForm.name" />
            </label>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Ciudad</span><input class="input-field" [(ngModel)]="beachForm.city" /></label>
              <label class="grid gap-1"><span class="label">Sector</span><input class="input-field" [(ngModel)]="beachForm.sector" /></label>
            </div>
            <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="beachForm.is_active" /> Activa</label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button class="btn-secondary" [disabled]="savingBeach()" (click)="showBeachForm.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="savingBeach()" (click)="saveBeach()">{{ savingBeach() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showPointForm()) {
      <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div class="w-full max-w-xl rounded-2xl bg-white p-4">
          <h3 class="text-lg font-bold mb-3">{{ editingPoint() ? 'Editar punto' : 'Nuevo punto' }}</h3>
          <div class="grid gap-3">
            <label class="grid gap-1">
              <span class="label">Nombre *</span>
              <input class="input-field" [(ngModel)]="pointForm.name" />
            </label>
            <div class="grid md:grid-cols-2 gap-3">
              <label class="grid gap-1"><span class="label">Lat *</span><input type="number" class="input-field" [(ngModel)]="pointForm.lat" /></label>
              <label class="grid gap-1"><span class="label">Lng *</span><input type="number" class="input-field" [(ngModel)]="pointForm.lng" /></label>
            </div>
            <app-tutty-map
              mode="picker"
              [lat]="pointForm.lat ?? null"
              [lng]="pointForm.lng ?? null"
              height="280px"
              (locationChange)="onPointPicked($event)">
            </app-tutty-map>
            <label class="grid gap-1">
              <span class="label">Referencia</span>
              <textarea class="input-field min-h-24" [(ngModel)]="pointForm.reference_notes"></textarea>
            </label>
            <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="pointForm.is_active" /> Activo</label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button class="btn-secondary" [disabled]="savingPoint()" (click)="showPointForm.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="savingPoint()" (click)="savePoint()">{{ savingPoint() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BeachesPageComponent implements OnInit {
  private readonly service = inject(BeachesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly loading = signal(true);
  readonly beaches = signal<BeachRow[]>([]);
  readonly points = signal<BeachPointRow[]>([]);
  readonly selectedBeach = signal<BeachRow | null>(null);
  readonly beachSearchTerm = signal('');

  readonly showBeachForm = signal(false);
  readonly showPointForm = signal(false);
  readonly editingBeach = signal<BeachRow | null>(null);
  readonly editingPoint = signal<BeachPointRow | null>(null);
  readonly savingBeach = signal(false);
  readonly savingPoint = signal(false);
  readonly savingCoverage = signal(false);

  readonly commerces = signal<Array<{ id: string; name: string; is_beach_delivery: boolean }>>([]);
  readonly selectedCoverageIds = signal<string[]>([]);
  readonly originalCoverageIds = signal<string[]>([]);
  readonly commercesWithCoverageCount = signal(0);
  selectedCommerceId = '';

  beachForm: Partial<BeachRow> = { name: '', city: '', sector: '', is_active: true };
  pointForm: Partial<BeachPointRow> = { name: '', lat: 18.4, lng: -69.9, reference_notes: '', is_active: true };

  readonly filteredBeaches = computed(() => {
    const term = this.beachSearchTerm().trim().toLowerCase();
    if (!term) return this.beaches();
    return this.beaches().filter((beach) => (
      beach.name.toLowerCase().includes(term)
      || (beach.city ?? '').toLowerCase().includes(term)
      || (beach.sector ?? '').toLowerCase().includes(term)
    ));
  });

  readonly statActiveBeaches = computed(() => this.beaches().filter((b) => b.is_active).length);
  readonly statTotalPoints = computed(() => this.beaches().reduce((sum, b) => sum + b.points_count, 0));
  readonly statBeachesWithPoints = computed(() => this.beaches().filter((b) => b.points_count > 0).length);

  readonly pendingCoverageChanges = computed(() => {
    if (!this.selectedCommerceId) return 0;
    const current = new Set(this.selectedCoverageIds());
    const original = new Set(this.originalCoverageIds());
    let changes = 0;
    for (const id of current) if (!original.has(id)) changes++;
    for (const id of original) if (!current.has(id)) changes++;
    return changes;
  });

  ngOnInit(): void {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [beaches, commerces, coverageCount] = await Promise.all([
        this.service.listBeaches(),
        this.service.listCommercesForCoverage(),
        this.service.countCommercesWithCoverage(),
      ]);
      this.beaches.set(beaches);
      this.commerces.set(commerces);
      this.commercesWithCoverageCount.set(coverageCount);
      const stillExists = this.selectedBeach() && beaches.some((b) => b.id === this.selectedBeach()!.id);
      if (stillExists) {
        await this.selectBeach(beaches.find((b) => b.id === this.selectedBeach()!.id)!);
      } else if (beaches.length > 0) {
        await this.selectBeach(beaches[0]);
      } else {
        this.selectedBeach.set(null);
        this.points.set([]);
      }
    } catch {
      this.toast.error('No se pudo cargar Beach Delivery');
    } finally {
      this.loading.set(false);
    }
  }

  async selectBeach(beach: BeachRow): Promise<void> {
    this.selectedBeach.set(beach);
    this.points.set(await this.service.listPoints(beach.id));
  }

  rowClass(beach: BeachRow): string {
    return this.selectedBeach()?.id === beach.id
      ? 'bg-[#fff3f8] shadow-[inset_3px_0_0_var(--admin-primary)]'
      : 'hover:bg-[#fffafd]';
  }

  pointsCountLabel(): string {
    const count = this.points().length;
    return count === 1 ? '1 punto de entrega configurado' : `${count} puntos de entrega configurados`;
  }

  beachCreatedLabel(beach: BeachRow): string {
    if (!beach.created_at) return '';
    const date = new Date(beach.created_at);
    if (Number.isNaN(date.getTime())) return '';
    return `Creada el ${date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }

  selectedCommerceHasBeachDelivery(): boolean {
    return this.commerces().find((c) => c.id === this.selectedCommerceId)?.is_beach_delivery === true;
  }

  openBeachForm(beach?: BeachRow): void {
    this.editingBeach.set(beach ?? null);
    this.beachForm = beach ? { ...beach } : { name: '', city: '', sector: '', is_active: true };
    this.showBeachForm.set(true);
  }

  async saveBeach(): Promise<void> {
    if (!this.beachForm.name?.trim()) {
      this.toast.error('El nombre es obligatorio');
      return;
    }
    this.savingBeach.set(true);
    try {
      await this.service.saveBeach({ ...this.editingBeach(), ...this.beachForm });
      this.showBeachForm.set(false);
      await this.loadAll();
      this.toast.success('Playa guardada');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'No se pudo guardar la playa');
    } finally {
      this.savingBeach.set(false);
    }
  }

  async deleteBeach(beach: BeachRow): Promise<void> {
    try {
      const activeOrders = await this.service.countActiveOrdersForBeach(beach.id);
      if (activeOrders > 0) {
        this.toast.error(`No se puede eliminar: hay ${activeOrders} pedido(s) activo(s) en esta playa.`);
        return;
      }
    } catch {
      this.toast.error('No se pudo verificar pedidos activos. Intenta de nuevo.');
      return;
    }

    const ok = await this.confirm.confirm({
      title: `Eliminar ${beach.name}`,
      message: `Esto también eliminará los ${beach.points_count} puntos de entrega asociados.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await this.service.deleteBeach(beach.id);
      await this.loadAll();
      this.toast.success('Playa eliminada');
    } catch {
      this.toast.error('No se pudo eliminar la playa');
    }
  }

  openPointForm(point?: BeachPointRow): void {
    const beachId = this.selectedBeach()?.id;
    if (!beachId) return;
    this.editingPoint.set(point ?? null);
    this.pointForm = point ? { ...point } : { beach_id: beachId, name: '', lat: 18.4, lng: -69.9, reference_notes: '', is_active: true };
    this.showPointForm.set(true);
  }

  async savePoint(): Promise<void> {
    const beachId = this.selectedBeach()?.id;
    if (!beachId || !this.pointForm.name?.trim() || this.pointForm.lat == null || this.pointForm.lng == null) {
      this.toast.error('Completa nombre y coordenadas del punto');
      return;
    }
    this.savingPoint.set(true);
    try {
      await this.service.savePoint({ ...this.editingPoint(), ...this.pointForm, beach_id: beachId });
      this.showPointForm.set(false);
      await this.selectBeach(this.selectedBeach()!);
      await this.loadAll();
      this.toast.success('Punto guardado');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'No se pudo guardar el punto');
    } finally {
      this.savingPoint.set(false);
    }
  }

  async deletePoint(point: BeachPointRow): Promise<void> {
    try {
      const activeOrders = await this.service.countActiveOrdersForPoint(point.id);
      if (activeOrders > 0) {
        this.toast.error(`No se puede eliminar: hay ${activeOrders} pedido(s) activo(s) en este punto.`);
        return;
      }
    } catch {
      this.toast.error('No se pudo verificar pedidos activos. Intenta de nuevo.');
      return;
    }

    const ok = await this.confirm.confirm({ title: `Eliminar punto ${point.name}`, message: 'Esta acción no se puede deshacer.', danger: true });
    if (!ok) return;
    try {
      await this.service.deletePoint(point.id);
      await this.selectBeach(this.selectedBeach()!);
      await this.loadAll();
      this.toast.success('Punto eliminado');
    } catch {
      this.toast.error('No se pudo eliminar el punto');
    }
  }

  async loadSelectedCoverage(): Promise<void> {
    if (!this.selectedCommerceId) {
      this.selectedCoverageIds.set([]);
      this.originalCoverageIds.set([]);
      return;
    }
    try {
      const coverage = await this.service.getCoverageByCommerce(this.selectedCommerceId);
      this.selectedCoverageIds.set(coverage);
      this.originalCoverageIds.set(coverage);
    } catch {
      this.toast.error('No se pudo cargar la cobertura del comercio');
    }
  }

  toggleCoverage(beachId: string): void {
    const current = this.selectedCoverageIds();
    if (current.includes(beachId)) {
      this.selectedCoverageIds.set(current.filter((id) => id !== beachId));
      return;
    }
    this.selectedCoverageIds.set([...current, beachId]);
  }

  async saveCoverage(): Promise<void> {
    if (!this.selectedCommerceId) return;
    this.savingCoverage.set(true);
    try {
      await this.service.saveCoverage(this.selectedCommerceId, this.selectedCoverageIds());
      this.originalCoverageIds.set(this.selectedCoverageIds());
      await this.loadAll();
      this.toast.success('Cobertura actualizada');
    } catch {
      this.toast.error('No se pudo guardar la cobertura');
    } finally {
      this.savingCoverage.set(false);
    }
  }

  onPointPicked(position: LatLng): void {
    this.pointForm = {
      ...this.pointForm,
      lat: Number(position.lat.toFixed(6)),
      lng: Number(position.lng.toFixed(6)),
    };
  }
}
