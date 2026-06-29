import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PromotionsService } from './promotions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { Promotion, PromoType, PromoUse } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

type PromoTab = 'activas' | 'programadas' | 'expiradas' | 'todas';

@Component({
  selector: 'app-promotions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, AdminEmptyStateComponent],
  template: `
    <app-page-header title="Promociones" subtitle="Códigos de descuento y ofertas">
      <button class="btn-primary" (click)="openForm()">+ Nueva promoción</button>
    </app-page-header>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
      @for (tab of tabs; track tab.key) {
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          [class]="activeTab() === tab.key ? 'bg-white text-gray-800 shadow-theme-xs' : 'text-gray-500 hover:text-gray-700'"
          (click)="activeTab.set(tab.key); loadPromotions()"
        >{{ tab.label }}</button>
      }
    </div>

    <!-- Search & Type filter -->
    <div class="flex flex-wrap gap-3 mb-4">
      <input
        type="search"
        class="input-field max-w-xs"
        placeholder="Buscar por código o nombre..."
        [(ngModel)]="searchText"
      />
      <select class="input-field w-48" [(ngModel)]="typeFilter">
        <option value="">Todos los tipos</option>
        <option value="percentage">Porcentaje (%)</option>
        <option value="fixed_amount">Monto fijo (RD$)</option>
        <option value="free_delivery">Delivery gratis</option>
      </select>
    </div>

    <!-- Table -->
    <div class="admin-table-card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usos</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Validez</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Restaurante</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Activo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8,9]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (filteredPromos().length === 0) {
              <tr>
                <td colspan="9" class="px-4 py-12 text-center text-gray-400">
                  <app-admin-empty-state
                    icon="money"
                    title="Sin promociones"
                    description="Crea una promoción para comenzar a medir descuentos y conversiones."
                    actionLabel="+ Nueva promoción"
                    (action)="openForm()" />
                </td>
              </tr>
            } @else {
              @for (p of filteredPromos(); track p.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <code class="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono font-bold">{{ p.code }}</code>
                  </td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ p.name }}</td>
                  <td class="px-4 py-3">
                    <span class="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{{ typeLabel(p.discount_type) }}</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">
                    {{ p.discount_type === 'percentage' ? p.discount_value + '%' : 'RD$ ' + p.discount_value }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">
                    {{ p.current_uses }} / {{ p.max_uses ?? '∞' }}
                    @if (p.max_uses) {
                      <div class="h-1 bg-gray-200 rounded mt-1 w-16">
                        <div class="h-1 bg-brand-500 rounded"
                          [style.width.%]="(p.current_uses / p.max_uses) * 100"></div>
                      </div>
                    }
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-500">
                    @if (p.valid_from || p.valid_until) {
                      <div class="flex flex-col gap-0.5">
                        <span class="text-gray-400">Desde</span>
                        <span>{{ formatDate(p.valid_from) }}</span>
                        <span class="text-gray-400 mt-0.5">Hasta</span>
                        <span [class.text-error-500]="isExpired(p.valid_until)">
                          {{ p.valid_until ? formatDate(p.valid_until) : '\u221e' }}
                        </span>
                      </div>
                    } @else { Sin límite }
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ $any(p)['restaurant_name'] ?? 'Todos' }}</td>
                  <td class="px-4 py-3">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                      [class]="p.is_active ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="togglePromo(p)"
                      role="switch"
                      [attr.aria-checked]="p.is_active"
                      [attr.aria-label]="p.is_active ? 'Desactivar promoción ' + p.name : 'Activar promoción ' + p.name"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="p.is_active ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-2">
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(p)">Editar</button>
                      <button class="text-brand-500 hover:text-brand-700 text-xs font-medium px-1" (click)="openStats(p)">Stats</button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Stats Modal -->
    @if (statsPromo()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="statsPromo.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <div>
              <h3 class="font-semibold text-gray-800">Estadísticas — {{ statsPromo()!.name }}</h3>
              <code class="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{{ statsPromo()!.code }}</code>
            </div>
            <button aria-label="Cerrar estadísticas de promoción" class="text-gray-400" (click)="statsPromo.set(null)">✕</button>
          </div>
          <div class="p-6 space-y-5">
            <!-- KPIs -->
            <div class="grid grid-cols-3 gap-4">
              <div class="card p-4">
                <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Usos</p>
                <p class="text-2xl font-bold text-gray-800">
                  {{ statsPromo()!.current_uses }} / {{ statsPromo()!.max_uses ?? '∞' }}
                </p>
                @if (statsPromo()!.max_uses) {
                  <div class="h-1.5 bg-gray-200 rounded mt-2">
                    <div class="h-1.5 bg-brand-500 rounded" [style.width.%]="(statsPromo()!.current_uses / statsPromo()!.max_uses!) * 100"></div>
                  </div>
                }
              </div>
              <div class="card p-4">
                <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Descuento total</p>
                @if (statsLoading()) {
                  <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                } @else {
                  <p class="text-2xl font-bold text-gray-800">RD$ {{ totalDiscount() | number:'1.0-0' }}</p>
                }
              </div>
              <div class="card p-4">
                <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Registros</p>
                @if (statsLoading()) {
                  <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                } @else {
                  <p class="text-2xl font-bold text-gray-800">{{ promoUses().length }}</p>
                }
              </div>
            </div>

            <!-- Last uses table -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Últimos usos</h4>
              @if (statsLoading()) {
                <div class="space-y-2">
                  @for (i of [1,2,3]; track i) {
                    <div class="animate-pulse h-10 bg-gray-200 rounded"></div>
                  }
                </div>
              } @else if (promoUses().length === 0) {
                <app-admin-empty-state
                  icon="search"
                  title="Sin usos registrados"
                  description="Esta promoción todavía no tiene consumos en pedidos."
                  variant="soft" />
              } @else {
                <table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Usuario</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Pedido</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Descuento</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Fecha</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (u of promoUses(); track u.id) {
                      <tr>
                        <td class="px-3 py-2 text-sm text-gray-800">{{ u.user_name }}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">{{ u.order_number }}</td>
                        <td class="px-3 py-2 text-sm font-medium text-gray-700">RD$ {{ u.discount_applied }}</td>
                        <td class="px-3 py-2 text-xs text-gray-400">{{ u.used_at | date:'dd/MM/yy' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Form modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold">{{ editingId() ? 'Editar promoción' : 'Nueva promoción' }}</h3>
            <button aria-label="Cerrar formulario de promoción" class="text-gray-400" (click)="showForm.set(false)">✕</button>
          </div>
          <form [formGroup]="promoForm" (ngSubmit)="save()" class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="label">Nombre *</label>
                <input class="input-field" formControlName="name" />
              </div>
              <div>
                <label class="label">Código *</label>
                <div class="flex gap-2">
                  <input class="input-field flex-1" formControlName="code" />
                  <button type="button" class="btn-secondary px-3" (click)="generateCode()">🎲</button>
                </div>
              </div>
              <div>
                <label class="label">Tipo</label>
                <select class="input-field" formControlName="discount_type">
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed_amount">Monto fijo (RD$)</option>
                  <option value="free_delivery">Delivery gratis</option>
                </select>
              </div>
              <div>
                <label class="label">Valor</label>
                <input class="input-field" type="number" formControlName="discount_value" />
              </div>
              <div>
                <label class="label">Monto mínimo (RD$)</label>
                <input class="input-field" type="number" formControlName="min_order_amount" />
              </div>
              <div>
                <label class="label">Máx. usos (vacío=ilimitado)</label>
                <input class="input-field" type="number" formControlName="max_uses" />
              </div>
              <div>
                <label class="label">Válido desde</label>
                <input class="input-field" type="date" formControlName="valid_from" />
              </div>
              <div>
                <label class="label">Válido hasta</label>
                <input class="input-field" type="date" formControlName="valid_until" />
              </div>
              <div class="col-span-2">
                <label class="label">Descripción</label>
                <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
              </div>
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="promoForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PromotionsPageComponent implements OnInit {
  private readonly service = inject(PromotionsService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly promotions = signal<Promotion[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saveLoading = signal(false);
  readonly activeTab = signal<PromoTab>('todas');

  // Stats
  readonly statsPromo = signal<Promotion | null>(null);
  readonly promoUses = signal<PromoUse[]>([]);
  readonly statsLoading = signal(false);
  readonly totalDiscount = () => this.promoUses().reduce((sum, u) => sum + (u.discount_applied ?? 0), 0);

  searchText = '';
  typeFilter = '';

  readonly tabs = [
    { key: 'activas' as PromoTab, label: 'Activas' },
    { key: 'programadas' as PromoTab, label: 'Programadas' },
    { key: 'expiradas' as PromoTab, label: 'Expiradas' },
    { key: 'todas' as PromoTab, label: 'Todas' },
  ];

  readonly promoForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    discount_type: ['percentage' as PromoType],
    discount_value: [0, Validators.required],
    min_order_amount: [null as number | null],
    max_uses: [null as number | null],
    valid_from: [null as string | null],
    valid_until: [null as string | null],
    description: [''],
  });

  readonly filteredPromos = () => {
    const now = new Date().toISOString().split('T')[0];
    let promos = this.promotions();
    if (this.activeTab() === 'activas') promos = promos.filter(p => p.is_active);
    else if (this.activeTab() === 'programadas') promos = promos.filter(p => p.valid_from && p.valid_from > now);
    else if (this.activeTab() === 'expiradas') promos = promos.filter(p => p.valid_until && p.valid_until < now);
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      promos = promos.filter(p => p.code?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q));
    }
    if (this.typeFilter) promos = promos.filter(p => p.discount_type === this.typeFilter);
    return promos;
  };

  ngOnInit(): void { this.loadPromotions(); }

  loadPromotions(): void {
    this.loading.set(true);
    this.service.getPromotions().subscribe({
      next: data => { this.promotions.set(data); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar'); this.loading.set(false); },
    });
  }

  openForm(p?: Promotion): void {
    this.editingId.set(p?.id ?? null);
    if (p) { this.promoForm.patchValue(p as any); }
    else { this.promoForm.reset({ discount_type: 'percentage', discount_value: 0 }); }
    this.showForm.set(true);
  }

  generateCode(): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.promoForm.patchValue({ code });
  }

  async save(): Promise<void> {
    if (this.promoForm.invalid) return;
    this.saveLoading.set(true);
    const val = this.promoForm.getRawValue();
    try {
      await this.service.savePromotion({
        ...(this.editingId() ? { id: this.editingId()! } : {}),
        name: val.name!,
        code: val.code!.toUpperCase(),
        discount_type: val.discount_type as PromoType,
        discount_value: val.discount_value ?? 0,
        min_order_amount: val.min_order_amount ?? null,
        max_uses: val.max_uses ?? null,
        valid_from: val.valid_from ?? null,
        valid_until: val.valid_until ?? null,
        description: val.description ?? null,
        is_active: true,
        current_uses: 0,
      });
      this.toastService.success('Promoción guardada');
      this.showForm.set(false);
      this.loadPromotions();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.saveLoading.set(false); }
  }

  async togglePromo(p: Promotion): Promise<void> {
    try {
      await this.service.togglePromotion(p.id, !p.is_active);
      this.promotions.update(list => list.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
    } catch { this.toastService.error('Error al actualizar'); }
  }

  typeLabel(type: PromoType): string {
    const map: Record<PromoType, string> = {
      percentage: 'Porcentaje', fixed_amount: 'Monto fijo', free_delivery: 'Delivery gratis',
    };
    return map[type] ?? type;
  }

  formatDate(isoString: string | null | undefined): string {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  isExpired(isoString: string | null | undefined): boolean {
    if (!isoString) return false;
    return new Date(isoString) < new Date();
  }

  openStats(p: Promotion): void {
    this.statsPromo.set(p);
    this.promoUses.set([]);
    this.statsLoading.set(true);
    this.service.getPromoUses(p.id).subscribe(uses => {
      this.promoUses.set(uses);
      this.statsLoading.set(false);
    });
  }
}
