import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { StoreAdminService } from './store-admin.service';
import { Restaurant } from '../../core/supabase/database.types';
import { AdminPageHeaderComponent } from './shared/admin-page-header.component';
import { AdminEmptyStateComponent } from './shared/admin-empty-state.component';

@Component({
  selector: 'app-store-select',
  standalone: true,
  imports: [CommonModule, AdminPageHeaderComponent, AdminEmptyStateComponent],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div class="w-full max-w-3xl">
        <!-- Header -->
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style="background: linear-gradient(135deg, #FF3C97 0%, #6B2059 100%);">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
          </div>
          <app-admin-page-header
            title="Selecciona tu comercio"
            [subtitle]="'Tienes ' + approvedStores().length + ' comercios vinculados. ¿Con cuál deseas trabajar?'" />
        </div>

        <!-- Stores Grid -->
        @if (approvedStores().length === 0) {
          <div class="mb-8">
            <app-admin-empty-state
              icon="map"
              title="No tienes comercios aprobados"
              description="Cuando tu comercio esté aprobado, podrás seleccionarlo aquí para administrar pedidos y catálogo." />
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            @for (store of approvedStores(); track store.id) {
              <button
                class="card p-5 text-left hover:ring-2 hover:ring-brand-500 transition-all group"
                [class.ring-2]="storeService.activeStoreId() === store.id"
                [class.ring-brand-500]="storeService.activeStoreId() === store.id"
                (click)="selectStore(store)"
              >
                <div class="flex items-start gap-4">
                  <!-- Logo -->
                  <div class="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    @if (store.logo_url) {
                      <img [src]="store.logo_url" [alt]="store.name" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-gray-400">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                        </svg>
                      </div>
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">{{ store.name }}</h3>
                      @if (store.is_open) {
                        <span class="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success-50 text-success-700 text-[10px] font-semibold">
                          <span class="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></span>
                          Abierto
                        </span>
                      } @else {
                        <span class="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold">
                          Cerrado
                        </span>
                      }
                    </div>
                    <p class="text-sm text-gray-500 mt-0.5">{{ commerceTypeLabel(store.commerce_type) }}</p>
                    @if (store.address) {
                      <p class="text-xs text-gray-400 mt-1 truncate">{{ store.address }}</p>
                    }
                  </div>

                  <svg class="w-5 h-5 text-gray-300 group-hover:text-brand-500 flex-shrink-0 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>
            }
          </div>
        }

        <!-- Logout link -->
        <div class="text-center">
          <button class="text-sm text-gray-400 hover:text-gray-600 transition-colors" (click)="logout()">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  `,
})
export class StoreSelectPageComponent implements OnInit {
  readonly storeService = inject(StoreAdminService);
  private readonly auth = inject(AuthService);

  readonly approvedStores = this.storeService.approvedStores;

  async ngOnInit() {
    const user = this.auth.currentUser();
    if (user && this.storeService.stores().length === 0) {
      await this.storeService.loadUserStores(user.id);
    }
  }

  selectStore(store: Restaurant) {
    this.storeService.setActiveStore(store.id);
  }

  commerceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      restaurante: 'Restaurante',
      farmacia: 'Farmacia',
      bodega: 'Bodega',
      colmado: 'Colmado',
      tienda_ropa: 'Tienda de Ropa',
      supermercado: 'Supermercado',
      electronica: 'Electrónica',
      otro: 'Comercio',
    };
    return labels[type] ?? 'Comercio';
  }

  logout() {
    this.auth.signOut();
  }
}
