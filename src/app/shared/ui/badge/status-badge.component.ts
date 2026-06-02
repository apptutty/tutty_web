import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeType = 'order' | 'booking' | 'restaurant';

@Component({
    selector: 'app-status-badge',
    standalone: true,
    imports: [CommonModule],
    template: `
    <span
      class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium leading-none"
      [class]="badgeClass"
    >{{ label }}</span>
  `,
})
export class StatusBadgeComponent {
    @Input() status = '';
    @Input() type: BadgeType = 'order';

    get label(): string {
        return this.labelMap[this.status] ?? this.status;
    }

    get badgeClass(): string {
        return this.classMap[this.status] ?? 'bg-gray-100 text-gray-600';
    }

    private readonly labelMap: Record<string, string> = {
        // Order statuses
        recibido: 'Recibido',
        confirmado: 'Confirmado',
        en_preparacion: 'En preparación',
        en_camino: 'En camino',
        entregado: 'Entregado',
        cancelado: 'Cancelado',
        // Booking statuses
        pendiente: 'Pendiente',
        completado: 'Completado',
        // Restaurant
        abierto: 'Abierto',
        cerrado: 'Cerrado',
        activo: 'Activo',
        inactivo: 'Inactivo',
    };

    private readonly classMap: Record<string, string> = {
        recibido: 'bg-warning-100 text-warning-700',
        confirmado: 'bg-brand-100 text-brand-700',
        en_preparacion: 'bg-orange-100 text-orange-600',
        en_camino: 'bg-purple-100 text-purple-700',
        entregado: 'bg-success-100 text-success-700',
        cancelado: 'bg-error-100 text-error-700',
        pendiente: 'bg-warning-100 text-warning-700',
        completado: 'bg-success-100 text-success-700',
        abierto: 'bg-success-100 text-success-700',
        cerrado: 'bg-gray-100 text-gray-600',
        activo: 'bg-success-100 text-success-700',
        inactivo: 'bg-error-100 text-error-700',
    };
}
