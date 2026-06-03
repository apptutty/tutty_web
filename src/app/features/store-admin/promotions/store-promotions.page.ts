import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-store-promotions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 lg:p-8 space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Promociones</h1>
      <div class="card p-10 text-center text-gray-400">
        <svg class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
        <p class="font-medium">Promociones</p>
        <p class="text-sm mt-1">Esta sección estará disponible próximamente.</p>
      </div>
    </div>
  `,
})
export class StorePromotionsPageComponent {}
