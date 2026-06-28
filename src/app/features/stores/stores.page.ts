import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StoresService, StoreFilters } from './stores.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { Restaurant, CommerceType, CommissionTier, ApprovalStatus } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

const COMMERCE_TABS: { label: string; value: CommerceType | '' }[] = [
    { label: 'Todos', value: '' },
    { label: 'Restaurantes', value: 'restaurante' },
    { label: 'Farmacias', value: 'farmacia' },
    { label: 'Bodegas', value: 'bodega' },
    { label: 'Colmados', value: 'colmado' },
    { label: 'Tiendas', value: 'tienda_ropa' },
    { label: 'Electrónica', value: 'electronica' },
    { label: 'Supermercados', value: 'supermercado' },
];

export const COMMERCE_ICONS: Record<string, string> = {
    restaurante: '🍽️',
    farmacia: '💊',
    bodega: '📦',
    colmado: '🛒',
    tienda_ropa: '👗',
    supermercado: '🛒',
    electronica: '📱',
    otro: '🏪',
};

export const COMMERCE_LABELS: Record<string, string> = {
    restaurante: 'Restaurante',
    farmacia: 'Farmacia',
    bodega: 'Bodega',
    colmado: 'Colmado',
    tienda_ropa: 'Tienda',
    supermercado: 'Supermercado',
    electronica: 'Electrónica',
    otro: 'Otro',
};

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
    pendiente: 'bg-warning-100 text-warning-700',
    aprobado: 'bg-success-100 text-success-700',
    rechazado: 'bg-error-100 text-error-700',
    suspendido: 'bg-gray-100 text-gray-600',
};

@Component({
    selector: 'app-stores-page',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, AdminEmptyStateComponent],
    template: `
    <app-page-header title="Comercios" subtitle="Gestión de todos los tipos de comercio">
      <button class="btn-primary" (click)="openForm()">+ Nuevo comercio</button>
    </app-page-header>

    <!-- Commerce type tabs (horizontal scroll on mobile) -->
    <div class="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 mb-4">
      <div class="flex gap-1 min-w-max">
        @for (tab of commerceTabs; track tab.value) {
          <button
            (click)="setCommerceType(tab.value)"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0"
            [class]="activeType() === tab.value
              ? 'bg-brand-500 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'"
          >{{ tab.label }}</button>
        }
      </div>
    </div>

    <!-- Secondary filters -->
    <div class="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
      <div class="relative flex-1 min-w-0">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="search"
          class="input-field pl-9 w-full"
          placeholder="Buscar por nombre o slug..."
          [(ngModel)]="searchText"
          (ngModelChange)="onSearch()"
        />
      </div>
      <div class="flex gap-2 flex-wrap sm:flex-nowrap">
        <select class="input-field flex-1 sm:w-44" [(ngModel)]="approvalFilter" (ngModelChange)="loadStores()">
          <option value="">Todas las aprobaciones</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
          <option value="suspendido">Suspendido</option>
        </select>
        <select class="input-field flex-1 sm:w-36" [(ngModel)]="openFilter" (ngModelChange)="loadStores()">
          <option value="">Todos</option>
          <option value="open">Abiertos</option>
          <option value="closed">Cerrados</option>
        </select>
      </div>
      @if (approvalFilter || openFilter) {
        <button class="btn-secondary text-sm w-full sm:w-auto" (click)="clearFilters()">✕ Limpiar</button>
      }
    </div>

    <!-- Table -->
    <div class="admin-table-card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Comercio</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Abierto</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Activo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Aprobación</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Acción</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (stores().length === 0) {
              <tr>
                <td colspan="8" class="px-4 py-12 text-center text-gray-400">
                  <app-admin-empty-state
                    icon="map"
                    title="Sin comercios"
                    description="No hay comercios para los filtros actuales." />
                </td>
              </tr>
            } @else {
              @for (s of stores(); track s.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <!-- Comercio: logo + name + type badge -->
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      @if (s.logo_url) {
                        <img [src]="s.logo_url" class="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      } @else {
                        <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                          {{ icon(s.commerce_type) }}
                        </div>
                      }
                      <div class="min-w-0">
                        <p class="font-medium text-gray-800 truncate">{{ s.name }}</p>
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                          {{ label(s.commerce_type) }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <!-- Admin -->
                  <td class="px-4 py-3">
                    <p class="text-gray-700">{{ s.admin_name ?? '—' }}</p>
                    <p class="text-xs text-gray-400">{{ s.admin_email ?? '' }}</p>
                  </td>
                  <!-- Toggle is_open -->
                  <td class="px-4 py-3 text-center">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                      [class]="s.is_open ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleOpen(s)"
                      [title]="s.is_open ? 'Cerrar comercio' : 'Abrir comercio'"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="s.is_open ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <!-- Toggle is_active -->
                  <td class="px-4 py-3 text-center">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                      [class]="s.is_active ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleActive(s)"
                      [title]="s.is_active ? 'Desactivar' : 'Activar'"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="s.is_active ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <!-- Approval -->
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                      [class]="approvalColor(s.approval_status)">
                      {{ s.approval_status }}
                    </span>
                  </td>
                  <!-- Rating -->
                  <td class="px-4 py-3 text-gray-600">⭐ {{ s.avg_rating | number:'1.1-1' }}</td>
                  <!-- Tier -->
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {{ tierLabel(s.commission_tier!) }} ({{ (s.commission_rate * 100).toFixed(0) }}%)
                    </span>
                  </td>
                  <!-- Actions dropdown -->
                  <td class="px-4 py-3 text-right">
                    <div class="relative inline-block">
                      <button
                        class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        (click)="$event.stopPropagation(); toggleMenu(s.id)"
                        title="Acciones"
                      >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      @if (openMenuId === s.id) {
                        <div class="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-theme-lg border border-gray-100 py-1 min-w-[168px]">
                          <button (click)="router.navigate(['/stores', s.id]); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            👁 Ver detalle
                          </button>
                          <button (click)="openForm(s); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            ✏️ Editar
                          </button>
                          <button (click)="router.navigate(['/stores', s.id, 'catalog']); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            📦 Catálogo
                          </button>
                          <button (click)="router.navigate(['/restaurants', s.id, 'zones']); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            📍 Zonas
                          </button>
                          <div class="border-t border-gray-100 my-1"></div>
                          <button (click)="deleteStore(s); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 text-left">
                            🗑️ Eliminar
                          </button>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <!-- Footer count -->
      @if (!loading() && stores().length > 0) {
        <div class="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          {{ stores().length }} comercio{{ stores().length !== 1 ? 's' : '' }}
        </div>
      }
    </div>

    <!-- Form Modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 class="font-semibold text-gray-800">
              {{ editingStore() ? 'Editar comercio' : 'Nuevo comercio' }}
            </h3>
            <button class="text-gray-400 hover:text-gray-600" (click)="showForm.set(false)">✕</button>
          </div>
          <form [formGroup]="storeForm" (ngSubmit)="saveStore()" class="p-6 space-y-6">
            <!-- Basic -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Información básica</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Nombre *</label>
                  <input class="input-field" formControlName="name" placeholder="Ej: Farmacia Cruz Verde" />
                </div>
                <div>
                  <label class="label">Slug *</label>
                  <input class="input-field" formControlName="slug" placeholder="farmacia-cruz-verde" />
                </div>
                <div>
                  <label class="label">Tipo de comercio *</label>
                  <select class="input-field" formControlName="commerce_type">
                    <option value="restaurante">🍽️ Restaurante</option>
                    <option value="farmacia">💊 Farmacia</option>
                    <option value="bodega">📦 Bodega</option>
                    <option value="colmado">🛒 Colmado</option>
                    <option value="tienda_ropa">👗 Tienda de Ropa</option>
                    <option value="supermercado">🛒 Supermercado</option>
                    <option value="electronica">📱 Electrónica</option>
                    <option value="otro">🏪 Otro</option>
                  </select>
                </div>
                <div>
                  <label class="label">WhatsApp</label>
                  <input class="input-field" formControlName="whatsapp_number" placeholder="8091234567" />
                </div>
                <div class="sm:col-span-2">
                  <label class="label">Descripción</label>
                  <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
                </div>
              </div>
            </div>
            <!-- Location -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Ubicación</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="label">Dirección *</label>
                  <input class="input-field" formControlName="address" />
                </div>
                <div>
                  <label class="label">Sector</label>
                  <input class="input-field" formControlName="sector" />
                </div>
                <div>
                  <label class="label">Ciudad *</label>
                  <input class="input-field" formControlName="city" />
                </div>
              </div>
            </div>
            <!-- Commission -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Comisión</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Tier</label>
                  <select class="input-field" formControlName="commission_tier">
                    <option value="onboarding">Onboarding</option>
                    <option value="estandar">Estándar</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label class="label">Tasa (%)</label>
                  <input class="input-field" type="number" step="0.1" min="1" max="99" formControlName="commission_rate_pct" />
                </div>
                <div>
                  <label class="label">Pedido mínimo (RD$)</label>
                  <input class="input-field" type="number" formControlName="min_order_amount" />
                </div>
                <div>
                  <label class="label">Tiempo delivery (min)</label>
                  <input class="input-field" type="number" formControlName="avg_delivery_time" />
                </div>
              </div>
            </div>
            <div class="flex gap-3 justify-end pt-2">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="storeForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class StoresPageComponent implements OnInit, OnDestroy {
    private readonly service = inject(StoresService);
    private readonly toast = inject(ToastService);
    private readonly confirm = inject(ConfirmService);
    private readonly fb = inject(FormBuilder);
    readonly router = inject(Router);

    readonly stores = signal<Restaurant[]>([]);
    readonly loading = signal(true);
    readonly showForm = signal(false);
    readonly editingStore = signal<Restaurant | null>(null);
    readonly saveLoading = signal(false);
    readonly activeType = signal<CommerceType | ''>('');

    searchText = '';
    approvalFilter: ApprovalStatus | '' = '';
    openFilter: 'open' | 'closed' | '' = '';
    openMenuId: string | null = null;
    private searchTimeout: any;

    toggleMenu(id: string): void {
        this.openMenuId = this.openMenuId === id ? null : id;
    }

    closeMenu(): void {
        this.openMenuId = null;
    }

    readonly commerceTabs = COMMERCE_TABS;

    readonly storeForm = this.fb.group({
        name: ['', Validators.required],
        slug: ['', Validators.required],
        description: [''],
        commerce_type: ['restaurante' as CommerceType, Validators.required],
        whatsapp_number: [''],
        address: ['', Validators.required],
        sector: [''],
        city: ['Santo Domingo', Validators.required],
        commission_tier: ['estandar' as CommissionTier],
        commission_rate_pct: [10, [Validators.min(1), Validators.max(99)]],
        min_order_amount: [200],
        avg_delivery_time: [30],
    });

    ngOnInit(): void { this.loadStores(); }
    ngOnDestroy(): void { clearTimeout(this.searchTimeout); }

    loadStores(): void {
        this.loading.set(true);
        const filters: StoreFilters = {
            commerce_type: this.activeType(),
            approval_status: this.approvalFilter,
            open_status: this.openFilter,
            search: this.searchText || undefined,
        };
        this.service.getStores(filters).subscribe({
            next: (data) => { this.stores.set(data); this.loading.set(false); },
            error: () => { this.toast.error('Error al cargar comercios'); this.loading.set(false); },
        });
    }

    setCommerceType(type: CommerceType | ''): void {
        this.activeType.set(type);
        this.loadStores();
    }

    onSearch(): void {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadStores(), 300);
    }

    clearFilters(): void {
        this.approvalFilter = '';
        this.openFilter = '';
        this.loadStores();
    }

    openForm(store?: Restaurant): void {
        this.editingStore.set(store ?? null);
        if (store) {
            this.storeForm.patchValue({
                ...store,
                commission_rate_pct: Math.round(store.commission_rate * 100),
            });
        } else {
            this.storeForm.reset({
                city: 'Santo Domingo',
                commerce_type: 'restaurante',
                commission_tier: 'estandar',
                commission_rate_pct: 10,
                min_order_amount: 200,
                avg_delivery_time: 30,
            });
        }
        this.showForm.set(true);
    }

    async saveStore(): Promise<void> {
        if (this.storeForm.invalid) return;
        this.saveLoading.set(true);
        const val = this.storeForm.getRawValue();
        const payload: Partial<Restaurant> = {
            ...(this.editingStore() ? { id: this.editingStore()!.id } : {}),
            name: val.name!,
            slug: val.slug!.toLowerCase().replace(/\s+/g, '-'),
            description: val.description ?? null,
            commerce_type: val.commerce_type as CommerceType,
            whatsapp_number: val.whatsapp_number ?? null,
            address: val.address!,
            sector: val.sector ?? null,
            city: val.city!,
            commission_tier: val.commission_tier as CommissionTier,
            commission_rate: (val.commission_rate_pct ?? 10) / 100,
            min_order_amount: val.min_order_amount ?? 200,
            avg_delivery_time: val.avg_delivery_time ?? 30,
        };
        try {
            await this.service.saveStore(payload);
            this.toast.success(this.editingStore() ? 'Comercio actualizado' : 'Comercio creado');
            this.showForm.set(false);
            this.loadStores();
        } catch {
            this.toast.error('Error al guardar comercio');
        } finally {
            this.saveLoading.set(false);
        }
    }

    async toggleOpen(store: Restaurant): Promise<void> {
        try {
            await this.service.toggleOpen(store.id, !store.is_open);
            this.stores.update(list => list.map(s => s.id === store.id ? { ...s, is_open: !s.is_open } : s));
        } catch { this.toast.error('Error al cambiar estado'); }
    }

    async toggleActive(store: Restaurant): Promise<void> {
        try {
            await this.service.toggleActive(store.id, !store.is_active);
            this.stores.update(list => list.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
        } catch { this.toast.error('Error al cambiar estado'); }
    }

    async deleteStore(store: Restaurant): Promise<void> {
        const ok = await this.confirm.confirm({ title: `¿Eliminar "${store.name}"?`, message: 'Esta acción no se puede deshacer.', danger: true });
        if (!ok) return;
        try {
            await this.service.deleteStore(store.id);
            this.stores.update(list => list.filter(s => s.id !== store.id));
            this.toast.success('Comercio eliminado');
        } catch { this.toast.error('Error al eliminar (puede tener pedidos asociados)'); }
    }

    icon(type: CommerceType): string { return COMMERCE_ICONS[type] ?? '🏪'; }
    label(type: CommerceType): string { return COMMERCE_LABELS[type] ?? type; }
    approvalColor(status: ApprovalStatus): string { return APPROVAL_COLORS[status] ?? 'bg-gray-100 text-gray-600'; }
    tierLabel(tier: CommissionTier | null | undefined): string {
        const map: Record<CommissionTier, string> = { onboarding: 'Onb.', estandar: 'Est.', medio: 'Med.', alto: 'Alto', premium: 'Prem.' };
        return tier ? (map[tier] ?? tier) : '—';
    }
}
