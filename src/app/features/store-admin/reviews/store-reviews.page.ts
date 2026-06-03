import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-store-reviews',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="p-6 lg:p-8 space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Reseñas</h1>
      <div class="card p-10 text-center text-gray-400">
        <svg class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        <p class="font-medium">Reseñas de clientes</p>
        <p class="text-sm mt-1">Esta sección estará disponible próximamente.</p>
      </div>
    </div>
  `,
})
export class StoreReviewsPageComponent { }
