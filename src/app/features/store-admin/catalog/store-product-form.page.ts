import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-store-product-form',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 lg:p-8 space-y-6">
      <div class="flex items-center gap-3">
        <a routerLink="../" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </a>
        <h1 class="text-2xl font-bold text-gray-900">Producto</h1>
      </div>
      <div class="card p-10 text-center text-gray-400">
        <p class="font-medium">Formulario de producto</p>
        <p class="text-sm mt-1">Esta sección estará disponible próximamente.</p>
      </div>
    </div>
  `,
})
export class StoreProductFormPageComponent {}
