import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';

@Component({
    selector: 'app-settings-shell',
    standalone: true,
    imports: [RouterModule, PageHeaderComponent],
    template: `
    <div class="p-6">
      <app-page-header title="Configuración" subtitle="Gestión de parámetros del sistema" />

      <div class="overflow-x-auto scrollbar-hide -mx-6 px-6 border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-0 min-w-max" aria-label="Secciones de configuración">
          @for (tab of tabs; track tab.path) {
            <a [routerLink]="tab.path" #rla="routerLinkActive" routerLinkActive="border-brand-500 text-brand-500"
               [attr.aria-current]="rla.isActive ? 'page' : null"
               class="border-b-2 py-3.5 px-3 text-sm font-medium whitespace-nowrap border-transparent text-gray-500 hover:text-gray-700 transition-colors min-h-[44px] flex items-center">
              {{ tab.label }}
            </a>
          }
        </nav>
      </div>

      <router-outlet />
    </div>
  `,
})
export class SettingsShellComponent {
    readonly tabs = [
        { path: 'general', label: 'General' },
        { path: 'delivery', label: 'Delivery & Precios' },
        { path: 'feriados', label: 'Feriados' },
        { path: 'notificaciones', label: 'Notificaciones' },
        { path: 'usuarios', label: 'Usuarios Admin' },
        { path: 'comercios', label: 'Comercios & Aprobación' },
        { path: 'categorias', label: 'Categorías' },
        { path: 'auditoria', label: 'Auditoría' },
        { path: 'surcharge', label: 'Simulador de Tarifas' },
    ];
}
