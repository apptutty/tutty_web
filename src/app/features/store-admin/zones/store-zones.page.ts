import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-store-zones',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="p-6 lg:p-8 space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Zonas de Entrega</h1>
      <div class="card p-10 text-center text-gray-400">
        <svg class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        <p class="font-medium">Zonas de entrega</p>
        <p class="text-sm mt-1">Esta sección estará disponible próximamente.</p>
      </div>
    </div>
  `,
})
export class StoreZonesPageComponent { }
