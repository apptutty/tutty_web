import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RestaurantsService } from './restaurants.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { Restaurant, CommissionTier } from '../../core/supabase/database.types';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
    selector: 'app-restaurants-page',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent],
    template: `
    <app-page-header title="Restaurantes" subtitle="Gestión de establecimientos">
      <button class="btn-primary" (click)="openForm()">+ Nuevo restaurante</button>
    </app-page-header>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <input
        type="search"
        class="input-field max-w-xs"
        placeholder="Buscar restaurante..."
        [(ngModel)]="searchText"
        (ngModelChange)="onSearch()"
      />
      <select class="input-field w-48" [(ngModel)]="categoryFilter">
        <option value="">Todas las categorías</option>
        <option value="Comida rápida">Comida rápida</option>
        <option value="Pizza">Pizza</option>
        <option value="Sushi">Sushi</option>
        <option value="Pollo">Pollo</option>
        <option value="Mariscos">Mariscos</option>
        <option value="Saludable">Saludable</option>
        <option value="Postres">Postres</option>
        <option value="Bebidas">Bebidas</option>
        <option value="Dominicana">Dominicana</option>
        <option value="Italiana">Italiana</option>
        <option value="Otra">Otra</option>
      </select>
      <select class="input-field w-44" [(ngModel)]="statusFilter">
        <option value="">Todos los estados</option>
        <option value="active">Solo activos</option>
        <option value="inactive">Solo inactivos</option>
        <option value="open">Solo abiertos</option>
        <option value="closed">Solo cerrados</option>
      </select>
      @if (categoryFilter || statusFilter) {
        <button class="btn-secondary text-sm" (click)="clearFilters()">✕ Limpiar</button>
      }
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ciudad</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Abierto</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Activo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comisión</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
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
            } @else if (restaurants().length === 0) {
              <tr>
                <td colspan="8" class="px-4 py-12 text-center text-gray-400">
                  <p class="text-4xl mb-2">🏪</p>
                  <p class="text-sm">Sin restaurantes</p>
                </td>
              </tr>
            } @else {
              @for (r of filteredRestaurants(); track r.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      @if (r.logo_url) {
                        <img [src]="r.logo_url" class="w-8 h-8 rounded-lg object-cover" />
                      }
                      <div>
                        <p class="text-sm font-medium text-gray-800">{{ r.name }}</p>
                        <p class="text-xs text-gray-400">{{ r.slug }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ r.category }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ r.city }}</td>
                  <td class="px-4 py-3">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                      [class]="r.is_open ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleOpen(r)"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="r.is_open ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <td class="px-4 py-3">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                      [class]="r.is_active ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleActive(r)"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="r.is_active ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">⭐ {{ r.rating }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {{ tierLabel(r.commission_tier) }} ({{ (r.commission_rate * 100).toFixed(0) }}%)
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-1">
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(r)">Editar</button>
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="router.navigate(['/restaurants', r.id, 'menu'])">Menú</button>
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="router.navigate(['/restaurants', r.id, 'zones'])">Zonas</button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Form Modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 class="font-semibold text-gray-800">
              {{ editingRestaurant() ? 'Editar restaurante' : 'Nuevo restaurante' }}
            </h3>
            <button class="text-gray-400 hover:text-gray-600" (click)="showForm.set(false)">✕</button>
          </div>
          <form [formGroup]="restaurantForm" (ngSubmit)="saveRestaurant()" class="p-6 space-y-6">
            <!-- Basic info -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Información básica</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Nombre *</label>
                  <input class="input-field" formControlName="name" placeholder="Ej: Burger Palace" />
                </div>
                <div>
                  <label class="label">Slug *</label>
                  <input class="input-field" formControlName="slug" placeholder="burger-palace" />
                </div>
                <div class="sm:col-span-2">
                  <label class="label">Descripción</label>
                  <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
                </div>
                <div>
                  <label class="label">Categoría *</label>
                  <select class="input-field" formControlName="category">
                    <option value="Comida rápida">Comida rápida</option>
                    <option value="Pizza">Pizza</option>
                    <option value="Sushi">Sushi</option>
                    <option value="Pollo">Pollo</option>
                    <option value="Mariscos">Mariscos</option>
                    <option value="Saludable">Saludable</option>
                    <option value="Postres">Postres</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Dominicana">Dominicana</option>
                    <option value="Italiana">Italiana</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
                <div>
                  <label class="label">WhatsApp</label>
                  <input class="input-field" formControlName="whatsapp" placeholder="8091234567" />
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
                  <input class="input-field" formControlName="sector" placeholder="Piantini" />
                </div>
                <div>
                  <label class="label">Ciudad *</label>
                  <input class="input-field" formControlName="city" placeholder="Santo Domingo" />
                </div>
              </div>
            </div>

            <!-- Financial -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Financiero</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Tier de comisión</label>
                  <select class="input-field" formControlName="commission_tier">
                    <option value="onboarding">Onboarding</option>
                    <option value="estandar">Estándar</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label class="label">Tasa comisión (%)</label>
                  <input class="input-field" type="number" step="0.01" min="1" max="99" formControlName="commission_rate_display" />
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
              <button type="submit" class="btn-primary" [disabled]="restaurantForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class RestaurantsPageComponent implements OnInit {
    private readonly service = inject(RestaurantsService);
    private readonly toastService = inject(ToastService);
    private readonly confirmService = inject(ConfirmService);
    private readonly fb = inject(FormBuilder);
    readonly router = inject(Router);

    readonly restaurants = signal<Restaurant[]>([]);
    readonly loading = signal(true);
    readonly showForm = signal(false);
    readonly editingRestaurant = signal<Restaurant | null>(null);
    readonly saveLoading = signal(false);

    searchText = '';
    categoryFilter = '';
    statusFilter = '';
    private searchTimeout: any;

    readonly filteredRestaurants = () => {
        let result = this.restaurants();
        if (this.categoryFilter) result = result.filter(r => r.category === this.categoryFilter);
        if (this.statusFilter === 'active') result = result.filter(r => r.is_active);
        else if (this.statusFilter === 'inactive') result = result.filter(r => !r.is_active);
        else if (this.statusFilter === 'open') result = result.filter(r => r.is_open);
        else if (this.statusFilter === 'closed') result = result.filter(r => !r.is_open);
        return result;
    };

    readonly restaurantForm = this.fb.group({
        name: ['', Validators.required],
        slug: ['', Validators.required],
        description: [''],
        category: ['', Validators.required],
        whatsapp: [''],
        address: ['', Validators.required],
        sector: [''],
        city: ['Santo Domingo', Validators.required],
        commission_tier: ['estandar' as CommissionTier],
        commission_rate_display: [10, [Validators.min(1), Validators.max(99)]],
        min_order_amount: [200],
        avg_delivery_time: [30],
    });

    ngOnInit(): void { this.loadRestaurants(); }

    loadRestaurants(): void {
        this.loading.set(true);
        this.service.getRestaurants(this.searchText || undefined).subscribe({
            next: ({ data }) => { this.restaurants.set(data); this.loading.set(false); },
            error: () => { this.toastService.error('Error al cargar restaurantes'); this.loading.set(false); },
        });
    }

    onSearch(): void {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadRestaurants(), 300);
    }

    clearFilters(): void {
        this.categoryFilter = '';
        this.statusFilter = '';
    }

    openForm(restaurant?: Restaurant): void {
        this.editingRestaurant.set(restaurant ?? null);
        if (restaurant) {
            this.restaurantForm.patchValue({
                ...restaurant,
                commission_rate_display: Math.round(restaurant.commission_rate * 100),
            });
        } else {
            this.restaurantForm.reset({ city: 'Santo Domingo', commission_tier: 'estandar', commission_rate_display: 10, min_order_amount: 200, avg_delivery_time: 30 });
        }
        this.showForm.set(true);
    }

    async saveRestaurant(): Promise<void> {
        if (this.restaurantForm.invalid) return;
        this.saveLoading.set(true);
        const val = this.restaurantForm.getRawValue();
        const payload: Partial<Restaurant> = {
            ...(this.editingRestaurant() ? { id: this.editingRestaurant()!.id } : {}),
            name: val.name!,
            slug: val.slug!.toLowerCase().replace(/\s+/g, '-'),
            description: val.description ?? null,
            category: val.category!,
            whatsapp: val.whatsapp ?? null,
            address: val.address!,
            sector: val.sector ?? null,
            city: val.city!,
            commission_tier: val.commission_tier as CommissionTier,
            commission_rate: (val.commission_rate_display ?? 10) / 100,
            min_order_amount: val.min_order_amount ?? 200,
            avg_delivery_time: val.avg_delivery_time ?? 30,
        };
        try {
            await this.service.saveRestaurant(payload);
            this.toastService.success(this.editingRestaurant() ? 'Restaurante actualizado' : 'Restaurante creado');
            this.showForm.set(false);
            this.loadRestaurants();
        } catch (e: any) {
            this.toastService.error(e?.message ?? 'Error al guardar');
        } finally {
            this.saveLoading.set(false);
        }
    }

    async toggleOpen(r: Restaurant): Promise<void> {
        try {
            await this.service.toggleRestaurantOpen(r.id, !r.is_open);
            this.restaurants.update(list => list.map(x => x.id === r.id ? { ...x, is_open: !r.is_open } : x));
        } catch { this.toastService.error('Error al actualizar'); }
    }

    async toggleActive(r: Restaurant): Promise<void> {
        try {
            await this.service.toggleRestaurantActive(r.id, !r.is_active);
            this.restaurants.update(list => list.map(x => x.id === r.id ? { ...x, is_active: !r.is_active } : x));
        } catch { this.toastService.error('Error al actualizar'); }
    }

    tierLabel(tier: CommissionTier): string {
        const map: Record<CommissionTier, string> = {
            onboarding: 'Onboarding', estandar: 'Estándar', medio: 'Medio', alto: 'Alto', premium: 'Premium',
        };
        return map[tier] ?? tier;
    }
}
