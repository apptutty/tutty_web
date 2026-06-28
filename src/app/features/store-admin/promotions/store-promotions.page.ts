import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminPageHeaderComponent } from '../shared/admin-page-header.component';
import { AdminEmptyStateComponent } from '../shared/admin-empty-state.component';

@Component({
    selector: 'app-store-promotions',
    standalone: true,
    imports: [CommonModule, AdminPageHeaderComponent, AdminEmptyStateComponent],
    template: `
    <div class="p-6 lg:p-8 space-y-6">
      <app-admin-page-header
        title="Promociones"
        subtitle="Configura descuentos y campañas para impulsar tus ventas." />
      <app-admin-empty-state
        icon="money"
        title="Promociones próximamente"
        description="Esta sección estará disponible en una próxima actualización." />
    </div>
  `,
})
export class StorePromotionsPageComponent { }
