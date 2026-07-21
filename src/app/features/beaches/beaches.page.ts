import { Component, OnInit, inject, signal } from '@angular/core';
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
      <app-page-header title="Beach Delivery" subtitle="Gestión de playas, puntos y cobertura por comercio">
        <button class="btn-primary text-sm" (click)="openBeachForm()">+ Nueva playa</button>
      </app-page-header>

      <section class="card p-4">
        <h3 class="text-base font-semibold text-gray-900 mb-3">Playas</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase text-gray-500">
                <th class="py-2">Playa</th>
                <th class="py-2">Ciudad/Sector</th>
                <th class="py-2 text-center">Activa</th>
                <th class="py-2 text-right">Puntos</th>
                <th class="py-2 text-right">Comercios</th>
                <th class="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (beach of beaches(); track beach.id) {
                <tr class="hover:bg-gray-50">
                  <td class="py-2 font-semibold text-gray-800">
                    <button type="button" class="text-left hover:text-brand-500" (click)="selectBeach(beach)">{{ beach.name }}</button>
                  </td>
                  <td class="py-2 text-gray-600">{{ beach.city || '—' }} @if (beach.sector) { · {{ beach.sector }} }</td>
                  <td class="py-2 text-center">
                    <span class="inline-flex px-2 py-1 rounded-full text-xs" [class]="beach.is_active ? 'bg-success-50 text-success-600' : 'bg-gray-100 text-gray-600'">
                      {{ beach.is_active ? 'Sí' : 'No' }}
                    </span>
                  </td>
                  <td class="py-2 text-right">{{ beach.points_count }}</td>
                  <td class="py-2 text-right">{{ beach.commerces_count }}</td>
                  <td class="py-2 text-right space-x-2">
                    <button class="btn-secondary text-xs" (click)="openBeachForm(beach)">Editar</button>
                    <button class="btn-secondary text-xs !text-error-600" (click)="deleteBeach(beach)">Eliminar</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold text-gray-900">Puntos de entrega @if (selectedBeach()) { · {{ selectedBeach()!.name }} }</h3>
          <button class="btn-secondary text-xs" [disabled]="!selectedBeach()" (click)="openPointForm()">+ Nuevo punto</button>
        </div>
        @if (!selectedBeach()) {
          <p class="text-sm text-gray-500">Selecciona una playa para gestionar sus puntos.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase text-gray-500">
                  <th class="py-2">Nombre</th>
                  <th class="py-2">Lat</th>
                  <th class="py-2">Lng</th>
                  <th class="py-2">Referencia</th>
                  <th class="py-2 text-center">Activo</th>
                  <th class="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (point of points(); track point.id) {
                  <tr>
                    <td class="py-2 font-medium">{{ point.name }}</td>
                    <td class="py-2">{{ point.lat }}</td>
                    <td class="py-2">{{ point.lng }}</td>
                    <td class="py-2 text-gray-600">{{ point.reference_notes || '—' }}</td>
                    <td class="py-2 text-center">{{ point.is_active ? 'Sí' : 'No' }}</td>
                    <td class="py-2 text-right space-x-2">
                      <button class="btn-secondary text-xs" (click)="openPointForm(point)">Editar</button>
                      <button class="btn-secondary text-xs !text-error-600" (click)="deletePoint(point)">Eliminar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="card p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900">Cobertura por comercio</h3>
          <select class="input-field max-w-sm" [(ngModel)]="selectedCommerceId" (ngModelChange)="loadSelectedCoverage()">
            <option value="">Selecciona un comercio</option>
            @for (commerce of commerces(); track commerce.id) {
              <option [value]="commerce.id">{{ commerce.name }}{{ commerce.is_beach_delivery ? ' · Entrega a playa' : '' }}</option>
            }
          </select>
        </div>
        @if (selectedCommerceId) {
          <div class="grid gap-2 md:grid-cols-2">
            @for (beach of beaches(); track beach.id) {
              <label class="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2">
                <div>
                  <p class="text-sm font-medium text-gray-800">{{ beach.name }}</p>
                  <p class="text-xs text-gray-500">{{ beach.city || 'Sin ciudad' }}</p>
                </div>
                <input type="checkbox" class="h-4 w-4 accent-pink-600" [checked]="selectedCoverageIds().includes(beach.id)" (change)="toggleCoverage(beach.id)" />
              </label>
            }
          </div>
          <div class="flex justify-end">
            <button class="btn-primary text-sm" (click)="saveCoverage()">Guardar cobertura</button>
          </div>
        }
      </section>
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
            <button class="btn-secondary" (click)="showBeachForm.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="saveBeach()">Guardar</button>
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
            <button class="btn-secondary" (click)="showPointForm.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="savePoint()">Guardar</button>
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

  readonly beaches = signal<BeachRow[]>([]);
  readonly points = signal<BeachPointRow[]>([]);
  readonly selectedBeach = signal<BeachRow | null>(null);

  readonly showBeachForm = signal(false);
  readonly showPointForm = signal(false);
  readonly editingBeach = signal<BeachRow | null>(null);
  readonly editingPoint = signal<BeachPointRow | null>(null);

  readonly commerces = signal<Array<{ id: string; name: string; is_beach_delivery: boolean }>>([]);
  readonly selectedCoverageIds = signal<string[]>([]);
  selectedCommerceId = '';

  beachForm: Partial<BeachRow> = { name: '', city: '', sector: '', is_active: true };
  pointForm: Partial<BeachPointRow> = { name: '', lat: 18.4, lng: -69.9, reference_notes: '', is_active: true };

  ngOnInit(): void {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    try {
      const [beaches, commerces] = await Promise.all([this.service.listBeaches(), this.service.listCommercesForCoverage()]);
      this.beaches.set(beaches);
      this.commerces.set(commerces);
      if (!this.selectedBeach() && beaches.length > 0) {
        await this.selectBeach(beaches[0]);
      }
    } catch {
      this.toast.error('No se pudo cargar Beach Delivery');
    }
  }

  async selectBeach(beach: BeachRow): Promise<void> {
    this.selectedBeach.set(beach);
    this.points.set(await this.service.listPoints(beach.id));
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
    try {
      await this.service.saveBeach({ ...this.editingBeach(), ...this.beachForm });
      this.showBeachForm.set(false);
      await this.loadAll();
      this.toast.success('Playa guardada');
    } catch {
      this.toast.error('No se pudo guardar la playa');
    }
  }

  async deleteBeach(beach: BeachRow): Promise<void> {
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
    try {
      await this.service.savePoint({ ...this.editingPoint(), ...this.pointForm, beach_id: beachId });
      this.showPointForm.set(false);
      await this.selectBeach(this.selectedBeach()!);
      await this.loadAll();
      this.toast.success('Punto guardado');
    } catch {
      this.toast.error('No se pudo guardar el punto');
    }
  }

  async deletePoint(point: BeachPointRow): Promise<void> {
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
      return;
    }
    try {
      this.selectedCoverageIds.set(await this.service.getCoverageByCommerce(this.selectedCommerceId));
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
    try {
      await this.service.saveCoverage(this.selectedCommerceId, this.selectedCoverageIds());
      await this.loadAll();
      this.toast.success('Cobertura actualizada');
    } catch {
      this.toast.error('No se pudo guardar la cobertura');
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
